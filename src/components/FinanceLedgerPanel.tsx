/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Coins,
  BookOpen,
  Building2,
  Wand2,
  Banknote, 
  Wallet,
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  FileText, 
  Send, 
  Plus, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Receipt, 
  ShieldAlert,
  Printer,
  X,
  ChevronDown,
  ChevronUp,
  Database,
  Flag,
  Lock,
  ShieldCheck,
  Download,
  Calendar,
  CalendarRange,
  Save,
  Settings,
  Trash2,
  User,
  Mail,
  UserCheck,
  CreditCard
} from "lucide-react";
import { useRequisitions, getActiveFiscalYear } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition, Project } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { getProjectRequisitions } from "../utils/budgetUtils";
import { GlobalFiscalOverview } from "./GlobalFiscalOverview";
import { motion, AnimatePresence } from "motion/react";
import { databaseService } from "../lib/databaseService";
import { printRequisitionVoucher } from "../utils/exportUtils";
import { ConfirmationModal } from "./ConfirmationModal";
import { useBackgroundRefresh } from "../hooks/useBackgroundRefresh";

const numberToWords = (numStr: string): string => {
  const cleanNum = parseFloat(numStr.replace(/,/g, ""));
  if (isNaN(cleanNum) || cleanNum < 0) return "";
  if (cleanNum === 0) return "Zero Kenya Shillings";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion", "Trillion"];

  const integerPart = Math.floor(cleanNum);
  const decimalPart = Math.round((cleanNum - integerPart) * 100);

  const convertSection = (n: number): string => {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + " ";
    }
    return str.trim();
  };

  let num = integerPart;
  let wordParts: string[] = [];
  let scaleIndex = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const chunkStr = convertSection(chunk);
      wordParts.unshift(chunkStr + (scales[scaleIndex] ? " " + scales[scaleIndex] : ""));
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  let result = wordParts.join(", ").trim();
  result = result ? `${result} Kenya Shillings` : "";

  if (decimalPart > 0) {
    const decimalWords = decimalPart < 20 ? ones[decimalPart] : `${tens[Math.floor(decimalPart / 10)]} ${ones[decimalPart % 10]}`.trim();
    if (result) {
      result += ` and ${decimalWords} Cents`;
    } else {
      result = `${decimalWords} Cents`;
    }
  } else if (result) {
    result += " Only";
  }

  return result.replace(/\s+/g, " ").trim();
};

export const FinanceLedgerPanel: React.FC = () => {
  const { 
    requisitions, 
    projects, 
    currentUser, 
    updateRequisitionStatus,
    addSystemLog,
    triggerToast,
    users,
    systemSettings,
    churchGroups,
    allocateBudgetForGroup,
    systemLogs,
    closeFinancialYear,
    openFinancialYear,
    fiscalYears,
    createFiscalYear,
    updateFiscalYearDates,
    deleteFiscalYear,
    toggleFiscalYearStatus,
    setActiveFiscalYear,
    cloneFiscalYearBudgets,
    updateProjectBudget,
    deleteProject,
    updateSystemSettings,
    ledgerBooks,
    createLedgerBook,
    updateLedgerBookBudget,
    seedAllEcosystemData,
    syncingTargets,
    canPerform
  } = useRequisitions();

  const handleToggleYearClosure = async () => {
    if (yearStatus === "OPEN") {
      await handleCloseYear();
    } else {
      setConfirmModal({
        isOpen: true,
        title: "Recheck / Reopen Financial Year",
        message: `Are you sure you want to RE-OPEN the financial year ${activeYear} books?\n\nThis will allow postings and adjustments of group budgets for the year ${activeYear}.`,
        onConfirm: async () => {
          closeConfirmModal();
          try {
            await openFinancialYear(activeYear);
            alert(`Financial year ${activeYear} books have been successfully RE-OPENED.`);
          } catch (err: any) {
            alert(err.message || "Failed to open books.");
          }
        }
      });
    }
  };

  const budgetLogs = useMemo(() => {
    return systemLogs.filter(log => 
      ['BUDGET_ALLOCATED', 'BUDGET_CREATED', 'BUDGET_ADJUSTMENT'].includes(log.action)
    ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [systemLogs]);

  const [budgetHistoryPage, setBudgetHistoryPage] = React.useState(1);
  const totalBudgetHistoryPages = Math.ceil(budgetLogs.length / 15);
  const paginatedBudgetLogs = useMemo(() => {
    const startIndex = (budgetHistoryPage - 1) * 15;
    return budgetLogs.slice(startIndex, startIndex + 15);
  }, [budgetLogs, budgetHistoryPage]);

  React.useEffect(() => {
    if (budgetHistoryPage > totalBudgetHistoryPages && totalBudgetHistoryPages > 0) {
      setBudgetHistoryPage(totalBudgetHistoryPages);
    }
  }, [totalBudgetHistoryPages, budgetHistoryPage]);

   // Budget allocation & closing books state
  const activeYear = getActiveFiscalYear();
  const yearStatus = systemSettings.fiscalYearStatus || "OPEN";
  

  const handleCloseYear = async () => {
    setConfirmModal({
      isOpen: true,
      title: "CRITICAL WARNING: Close Financial Year",
      message: `Are you sure you want to CLOSE the financial year ${activeYear} books?\n\nThis will lock all allocations, disbursements, and approvals for the year ${activeYear}. This action is authoritative and recorded in the digital audit trail.`,
      isDestructive: true,
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await closeFinancialYear(activeYear);
          alert(`Financial year ${activeYear} books have been successfully CLOSED.`);
        } catch (err: any) {
          alert(err.message || "Failed to close books.");
        }
      }
    });
  };

  const handleOpenNextYear = async () => {
    const nextY = activeYear + 1;
    setConfirmModal({
      isOpen: true,
      title: "Open Next Financial Year",
      message: `Are you sure you want to OPEN the next Financial Year ${nextY} books?\n\nThis will shift the system active context to the year ${nextY} and initialize group budget sheets.`,
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await openFinancialYear(nextY);
          alert(`Financial year ${nextY} books have been successfully OPENED!`);
        } catch (err: any) {
          alert(err.message || "Failed to open next year.");
        }
      }
    });
  };

  // Fiscal Year Custom States
  const [newFyYear, setNewFyYear] = React.useState("");
  const [newFyLabel, setNewFyLabel] = React.useState("");
  const [newFyStatus, setNewFyStatus] = React.useState<"OPEN" | "CLOSED">("OPEN");
  const [newFyNotes, setNewFyNotes] = React.useState("");
  const [newFyStartDate, setNewFyStartDate] = React.useState("");
  const [newFyEndDate, setNewFyEndDate] = React.useState("");
  const [showAddFY, setShowAddFY] = React.useState(false);
  const [isCreatingFY, setIsCreatingFY] = React.useState(false);

  // Fiscal Year Editing / Management Modal States
  const [managingFy, setManagingFy] = React.useState<any | null>(null);
  const [editFyLabel, setEditFyLabel] = React.useState("");
  const [editFyStartDate, setEditFyStartDate] = React.useState("");
  const [editFyEndDate, setEditFyEndDate] = React.useState("");
  const [editFyNotes, setEditFyNotes] = React.useState("");
  const [isSavingEditFy, setIsSavingEditFy] = React.useState(false);

  // Background refresh hook usage
  useBackgroundRefresh(60000);

  // Modal State & Authorization
  const canManageBudgets = canPerform('canManageBudgets') || canPerform('canManageSettings') || currentUser?.role === UserRole.SUPER_ADMIN;
  const canExport = canPerform('canExportReports') || currentUser?.role === UserRole.SUPER_ADMIN;
  const canDisburse = canPerform('canDisburse') || currentUser?.role === UserRole.SUPER_ADMIN;
  const isFinanceOrAdmin = canManageBudgets || canDisburse || currentUser?.role === UserRole.FINANCE || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  // New Year Setup Wizard state
  const [showWizard, setShowWizard] = React.useState(false);
  const [wizardSourceYear, setWizardSourceYear] = React.useState(activeYear);
  const [wizardTargetYear, setWizardTargetYear] = React.useState(activeYear + 1);
  const [wizardTitle, setWizardTitle] = React.useState(`FY ${activeYear + 1} Budget Baseline`);
  const [wizardNotes, setWizardNotes] = React.useState("Cloned allocations dynamically from " + activeYear);
  const [wizardSetActive, setWizardSetActive] = React.useState(true);
  const [isCloning, setIsCloning] = React.useState(false);

  // Sync state values when activeYear shifts
  React.useEffect(() => {
    setWizardSourceYear(activeYear);
    setWizardTargetYear(activeYear + 1);
    setWizardTitle(`FY ${activeYear + 1} Budget Baseline`);
    setWizardNotes(`Cloned allocations dynamically from ${activeYear}`);
  }, [activeYear]);

  const isAdminOrSuperAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  // Fiscal Year Setup States
  const [targetFiscalYearForDates, setTargetFiscalYearForDates] = React.useState<number>(activeYear);
  const [fyStartDate, setFyStartDate] = React.useState<string>(`${activeYear}-01-01`);
  const [fyEndDate, setFyEndDate] = React.useState<string>(`${activeYear}-12-31`);
  const [isSavingDates, setIsSavingDates] = React.useState<boolean>(false);

  React.useEffect(() => {
    setTargetFiscalYearForDates(activeYear);
  }, [activeYear]);

  React.useEffect(() => {
    const fyObj = fiscalYears.find(f => f.year === targetFiscalYearForDates);
    if (fyObj?.startDate) {
      setFyStartDate(fyObj.startDate);
    } else if (systemSettings?.fiscalYearStartDate && targetFiscalYearForDates === activeYear) {
      setFyStartDate(systemSettings.fiscalYearStartDate);
    } else {
      setFyStartDate(`${targetFiscalYearForDates}-01-01`);
    }

    if (fyObj?.endDate) {
      setFyEndDate(fyObj.endDate);
    } else if (systemSettings?.fiscalYearEndDate && targetFiscalYearForDates === activeYear) {
      setFyEndDate(systemSettings.fiscalYearEndDate);
    } else {
      setFyEndDate(`${targetFiscalYearForDates}-12-31`);
    }
  }, [targetFiscalYearForDates, activeYear, fiscalYears, systemSettings]);

  const handleSaveFiscalDates = async () => {
    if (!fyStartDate || !fyEndDate) return;
    setIsSavingDates(true);
    try {
      if (updateFiscalYearDates) {
        await updateFiscalYearDates(targetFiscalYearForDates, fyStartDate, fyEndDate);
      } else {
        await updateSystemSettings({
          fiscalYearStartDate: fyStartDate,
          fiscalYearEndDate: fyEndDate
        });
      }
    } catch (err: any) {
      console.error("Failed to save fiscal year dates:", err);
      alert(err.message || "Failed to save fiscal year dates.");
    } finally {
      setIsSavingDates(false);
    }
  };

  const handleEditProjectBudget = async (project: Project) => {
    if (!isFinanceOrAdmin) {
      alert("Unauthorized: Only Finance/Admins can modify Group Budgets.");
      return;
    }
    const val = prompt(`Enter new allocated budget for ${project.name}:`, project.allocatedBudget.toString());
    if (val === null) return;
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) {
      alert("Invalid amount.");
      return;
    }
    try {
      await updateProjectBudget(project.id, parsed);
      triggerToast({ type: 'SYSTEM_INFO', severity: 'MEDIUM', message: `Budget for ${project.name} updated to KES ${parsed.toLocaleString()}`, timestamp: new Date().toISOString() });
    } catch (e: any) {
      alert("Failed to update budget: " + e.message);
    }
  };

  const handleDeleteProjectBudget = async (project: Project) => {
    if (!isFinanceOrAdmin) {
      alert("Unauthorized: Only Finance/Admins can delete Group Budgets.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Delete Budget Allocation",
      message: `Are you sure you want to completely delete the budget allocation for ${project.name} (FY ${project.fiscalYear})?\n\nThis will orphan any existing requisitions tied to this line. Proceed with caution.`,
      isDestructive: true,
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await deleteProject(project.id);
          triggerToast({ type: 'SYSTEM_INFO', severity: 'MEDIUM', message: `Budget for ${project.name} deleted.`, timestamp: new Date().toISOString() });
        } catch (e: any) {
          alert("Failed to delete budget: " + e.message);
        }
      }
    });
  };

  const handleRunWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wizardSourceYear === wizardTargetYear) {
      alert("Source year and Target year must be different.");
      return;
    }
    if (!wizardTargetYear || wizardTargetYear < 1000 || wizardTargetYear > 9999) {
      alert("Target year must be a valid 4-digit year.");
      return;
    }
    if (!wizardTitle.trim()) {
      alert("Please enter a title for the new fiscal year.");
      return;
    }

    setIsCloning(true);
    try {
      await cloneFiscalYearBudgets(
        wizardSourceYear,
        wizardTargetYear,
        wizardTitle.trim(),
        wizardNotes.trim(),
        wizardSetActive
      );
      setShowWizard(false);
      alert(`Wizard completed: budget allocations duplicated successfully into FY ${wizardTargetYear}.`);
    } catch (err: any) {
      alert(err.message || "Failed to clone fiscal year budget lines.");
    } finally {
      setIsCloning(false);
    }
  };

  const handleCreateFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const yr = parseInt(newFyYear);
    if (!newFyYear || isNaN(yr) || yr < 1000 || yr > 9999) {
      alert("Please enter a valid 4-digit financial year number.");
      return;
    }
    if (!newFyLabel.trim()) {
      alert("Please provide a descriptor label for the new financial year (e.g., FY 2027 Baseline Plan).");
      return;
    }

    setIsCreatingFY(true);
    try {
      await createFiscalYear(
        yr, 
        newFyLabel.trim(), 
        newFyStatus, 
        newFyNotes.trim(), 
        newFyStartDate || undefined, 
        newFyEndDate || undefined
      );
      setNewFyYear("");
      setNewFyLabel("");
      setNewFyNotes("");
      setNewFyStartDate("");
      setNewFyEndDate("");
      setShowAddFY(false);
      alert(`Financial Year ${yr} successfully defined and logged.`);
    } catch (err: any) {
      alert(err.message || "Failed to create fiscal year.");
    } finally {
      setIsCreatingFY(false);
    }
  };

  const handleSetActiveFY = async (yr: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Set Active Financial Year",
      message: `Are you sure you want to switch the system's ACTIVE financial year context to ${yr}?\n\nThis will automatically direct all new requisitions and budget queries to ${yr} lines.`,
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await setActiveFiscalYear(yr);
          alert(`Successfully switched active operational context to financial year ${yr}.`);
        } catch (err: any) {
          alert(err.message || "Failed to switch active fiscal year.");
        }
      }
    });
  };

  const handleToggleFYStatus = async (yrId: string, currentStatus: "OPEN" | "CLOSED" | "ARCHIVED") => {
    if (currentStatus === "ARCHIVED") return;
    const nextStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
    setConfirmModal({
      isOpen: true,
      title: "Toggle Financial Year Status",
      message: `Are you sure you want to ${nextStatus === "OPEN" ? "OPEN" : "CLOSE"} books for Financial Year ${yrId}?\n\n${nextStatus === "CLOSED" ? "This will freeze all new acquisitions and payouts under these FY books." : "This will re-allow group disbursements and allocations."}`,
      isDestructive: nextStatus === "CLOSED",
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await toggleFiscalYearStatus(yrId, nextStatus);
          alert(`Financial Year ${yrId} books are now ${nextStatus}.`);
        } catch (err: any) {
          alert(err.message || "Failed to toggle status.");
        }
      }
    });
  };

  const handleArchiveFY = async (yrId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Archive Financial Year",
      message: `⚠️ WARNING: Are you sure you want to ARCHIVE Financial Year ${yrId}?\n\nThis will permanently move all data under FY ${yrId} to a read-only historical report view and completely block future submissions. This action is irreversible.`,
      isDestructive: true,
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await toggleFiscalYearStatus(yrId, "ARCHIVED");
          alert(`Financial Year ${yrId} has been successfully archived.`);
        } catch (err: any) {
          alert(err.message || "Failed to archive fiscal year.");
        }
      }
    });
  };

  const prevYear = activeYear - 1;
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [budgetListSearch, setBudgetListSearch] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationAccountNumber, setAllocationAccountNumber] = useState("");
  const [isAllocating, setIsAllocating] = useState(false);

  // Search, Order & Pagination for Ministry Group Budget Reserves
  const [reservesSearchQuery, setReservesSearchQuery] = useState("");
  const [reservesPage, setReservesPage] = useState(1);
  const itemsPerPage = 15;

  const isDuplicateGroup = useMemo(() => {
    if (!selectedGroupId) return false;
    return projects.some(p => 
      p.groupId === selectedGroupId && 
      p.fiscalYear === activeYear
    );
  }, [selectedGroupId, activeYear, projects]);

  const isDuplicateAccountNumber = useMemo(() => {
    const actNum = allocationAccountNumber.trim().toLowerCase();
    if (!actNum) return false;
    return projects.some(p => 
      p.accountNumber?.trim().toLowerCase() === actNum &&
      p.groupId !== selectedGroupId
    );
  }, [allocationAccountNumber, selectedGroupId, projects]);

  const processedProjects = useMemo(() => {
    let filtered = projects.filter(p => p.fiscalYear === activeYear);

    // Limit to user's valid groups if not admin/finance
    if (!isFinanceOrAdmin && currentUser) {
      const allowedGroups = [
        currentUser.group,
        ...(currentUser.groups || [])
      ].filter(Boolean); // removes undefined/null/empty strings
      
      if (allowedGroups.length > 0) {
        filtered = filtered.filter(p => allowedGroups.includes(p.groupId));
      } else {
        // if they have no groups assigned, they shouldn't see any
        filtered = [];
      }
    }

    // Filter by search query
    const q = reservesSearchQuery.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.accountNumber && p.accountNumber.toLowerCase().includes(q)) ||
        (p.groupId && p.groupId.toLowerCase().includes(q))
      );
    }

    // Arrange the list in alphabetical order
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  }, [projects, reservesSearchQuery]);

  const paginatedProjects = useMemo(() => {
    const startIndex = (reservesPage - 1) * itemsPerPage;
    return processedProjects.slice(startIndex, startIndex + itemsPerPage);
  }, [processedProjects, reservesPage]);

  const totalReservesPages = Math.max(1, Math.ceil(processedProjects.length / itemsPerPage));

  React.useEffect(() => {
    if (reservesPage > totalReservesPages) {
      setReservesPage(totalReservesPages);
    }
  }, [totalReservesPages, reservesPage]);

  const filteredGroups = useMemo(() => {
    const query = groupSearchQuery.toLowerCase().trim();
    if (!query) return churchGroups;
    return churchGroups.filter(cg =>
      cg.name.toLowerCase().includes(query) ||
      (cg.description && cg.description.toLowerCase().includes(query))
    );
  }, [churchGroups, groupSearchQuery]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Remove all characters except digits and decimal point
    const cleanVal = val.replace(/[^\d.]/g, "");
    // Ensure only one decimal point
    const parts = cleanVal.split(".");
    let sanitized = parts[0];
    if (parts.length > 1) {
      sanitized += "." + parts.slice(1).join("").substring(0, 2);
    }
    
    if (sanitized === "") {
      setAllocationAmount("");
      return;
    }
    
    const [integer, decimal] = sanitized.split(".");
    const parsedInt = Number(integer);
    if (!isNaN(parsedInt)) {
      const formattedInt = parsedInt.toLocaleString("en-US");
      const finalFormatted = decimal !== undefined ? `${formattedInt}.${decimal}` : formattedInt;
      setAllocationAmount(finalFormatted);
    }
  };

  const prevYearData = useMemo(() => {
    if (!selectedGroupId) return null;
    const proj = projects.find(p => p.name === selectedGroupId && p.fiscalYear === prevYear);
    const reqs = requisitions.filter(r => r.groupName === selectedGroupId && r.fiscalYear === prevYear && (r.status === RequisitionStatus.DISBURSED || r.status === RequisitionStatus.APPROVED_L2));
    const totalUsed = reqs.reduce((acc, r) => acc + r.amount, 0);
    return { allocated: proj?.allocatedBudget || 0, used: totalUsed };
  }, [selectedGroupId, activeYear, prevYear, projects, requisitions]);
  
  console.log("FinanceLedgerPanel Debug:", { currentUser, activeYear, yearStatus });

  const handleAllocateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      alert("Please select a group");
      return;
    }
    const amt = parseFloat(allocationAmount.replace(/,/g, ""));
    if (isNaN(amt) || amt < 0) {
      alert("Please enter a valid amount larger than or equal to 0");
      return;
    }

    if (isDuplicateGroup) {
      alert(`Duplicate Reserve Detected: An active budget reserve is already defined for "${selectedGroupId}" in FY ${activeYear}. Duplicate reserves are locked out.`);
      return;
    }

    if (!allocationAccountNumber.trim()) {
      alert("Please assign a unique account number for the group budget reserve.");
      return;
    }

    if (isDuplicateAccountNumber) {
      alert(`Duplicate Account Number: "${allocationAccountNumber}" is already assigned to another group reserve.`);
      return;
    }

    setIsAllocating(true);
    try {
      await allocateBudgetForGroup(selectedGroupId, amt, activeYear, allocationAccountNumber.trim() || undefined);
      setAllocationAmount("");
      setAllocationAccountNumber("");
      setSelectedGroupId("");
      setGroupSearchQuery("");
      alert(`Successfully allocated KES ${amt.toLocaleString()} budget limit to '${selectedGroupId}' for FY ${activeYear}.`);
    } catch (err: any) {
      alert(err.message || "Failed to allocate budget.");
    } finally {
      setIsAllocating(false);
    }
  };

  // Component state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_DISBURSAL" | "DISBURSED">("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"ledgers" | "budgets" | "ministry_ledgers">(isFinanceOrAdmin ? "ledgers" : "budgets");
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);

  // Ministry Ledger Books State
  const [selectedLedgerMinistry, setSelectedLedgerMinistry] = useState("");
  const [ledgerLimitAmount, setLedgerLimitAmount] = useState("");
  const [ledgerNotes, setLedgerNotes] = useState("");
  const [isCreatingLedger, setIsCreatingLedger] = useState(false);
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(null);
  const [editingLedgerLimit, setEditingLedgerLimit] = useState("");
  const [isUpdatingLedger, setIsUpdatingLedger] = useState(false);

  const handleCreateLedgerBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedgerMinistry) {
      alert("Please select a ministry.");
      return;
    }
    
    const amt = parseFloat(ledgerLimitAmount.replace(/[^\d.]/g, ""));
    if (isNaN(amt) || amt < 0) {
      alert("Please enter a valid budget limit.");
      return;
    }

    setIsCreatingLedger(true);
    try {
      const defaultBookName = `${selectedLedgerMinistry} General Ledger`;
      await createLedgerBook(selectedLedgerMinistry, defaultBookName, amt);
      setSelectedLedgerMinistry("");
      setLedgerLimitAmount("");
      alert("Ministry General Ledger Book has been successfully initialized.");
    } catch (err: any) {
      alert(err.message || "Failed to create ledger book.");
    } finally {
      setIsCreatingLedger(false);
    }
  };

  const handleUpdateLedgerLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLedgerId) return;
    const amt = parseFloat(editingLedgerLimit.replace(/[^\d.]/g, ""));
    if (isNaN(amt) || amt < 0) {
      alert("Please enter a valid budget limit.");
      return;
    }

    setIsUpdatingLedger(true);
    try {
      await updateLedgerBookBudget(editingLedgerId, amt);
      setEditingLedgerId(null);
      setEditingLedgerLimit("");
      alert("Ministry Ledger Book budget limit has been successfully adjusted.");
    } catch (err: any) {
      alert(err.message || "Failed to update ledger book limit.");
    } finally {
      setIsUpdatingLedger(false);
    }
  };

  // Budget adjustment form state
  const [adjustingProject, setAdjustingProject] = useState<Project | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [reqLimitAmount, setReqLimitAmount] = useState<string>("");
  const [adjustingAccountNumber, setAdjustingAccountNumber] = useState<string>("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const isDuplicateAccountNumberForEdit = useMemo(() => {
    if (!adjustingProject) return false;
    const actNum = adjustingAccountNumber.trim().toLowerCase();
    if (!actNum) return false;
    return projects.some(p => 
      p.id !== adjustingProject.id &&
      p.accountNumber?.trim().toLowerCase() === actNum &&
      p.groupId !== adjustingProject.groupId
    );
  }, [adjustingAccountNumber, adjustingProject, projects]);

  React.useEffect(() => {
    if (adjustingProject) {
      setTopUpAmount(adjustingProject.allocatedBudget.toString());
      setReqLimitAmount((adjustingProject.requisitionLimit || adjustingProject.allocatedBudget).toString());
      setAdjustingAccountNumber(adjustingProject.accountNumber || "");
    } else {
      setTopUpAmount("");
      setReqLimitAmount("");
      setAdjustingAccountNumber("");
    }
  }, [adjustingProject]);

  // Disbursement form state
  const [disbursingReq, setDisbursingReq] = useState<Requisition | null>(null);
  const [disburseMethod, setDisburseMethod] = useState<"EFT" | "MPESA" | "CHEQUE" | "CASH">("MPESA");
  const [referenceNum, setReferenceNum] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [isCommitingPayout, setIsCommitingPayout] = useState(false);

  // Mapping ministry groups to chart/category codes for double-entry tracking
  const getAccountingCode = (groupId: string): { code: string; name: string } => {
    const formatted = (groupId || "").toLowerCase();
    if (formatted.includes("youth")) {
      return { code: "4020", name: "Outreach & Youth Camps" };
    } else if (formatted.includes("women") || formatted.includes("guild")) {
      return { code: "4030", name: "Women's Guild Ministry" };
    } else if (formatted.includes("choir")) {
      return { code: "4010", name: "Choir Admin & Equipment" };
    } else if (formatted.includes("sanctuary") || formatted.includes("building")) {
      return { code: "4040", name: "Sanctuary Maintenance" };
    } else if (formatted.includes("sunday") || formatted.includes("school")) {
      return { code: "4050", name: "Sunday School Media" };
    } else if (formatted.includes("pioneer")) {
      return { code: "4060", name: "Pioneer Ministry Dev" };
    }
    return { code: "4090", name: "Ministry General Expenses" };
  };

  // 1. Calculate Financial Metrics
  const metrics = useMemo(() => {
    // Total approved or disbursed, which represents total committed funds
    const totalDisbursed = requisitions
      .filter(r => r.status === RequisitionStatus.DISBURSED)
      .reduce((acc, r) => acc + r.amount, 0);

    const pendingDisbursalCount = requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2).length;
    const totalCommittedPending = requisitions
      .filter(r => r.status === RequisitionStatus.APPROVED_L2)
      .reduce((acc, r) => acc + r.amount, 0);

    const activeProjects = projects.filter(p => p.fiscalYear === activeYear || (!p.fiscalYear && activeYear === 2026));
    const totalActiveBudget = activeProjects.length > 0
      ? activeProjects.reduce((acc, p) => acc + (p.allocatedBudget || 0), 0)
      : projects.reduce((acc, p) => acc + (p.allocatedBudget || 0), 0);

    const totalRemainingBudget = (activeProjects.length > 0 ? activeProjects : projects).reduce((acc, p) => {
      const projectReqs = getProjectRequisitions(p, requisitions);
      const usedAmount = projectReqs
        .filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED].includes(r.status))
        .reduce((sum, r) => sum + r.amount, 0);
      return acc + (p.allocatedBudget - usedAmount);
    }, 0);

    // Disbursement efficiency: simulated speed
    const approvedRequisitions = requisitions.filter(
      r => r.status === RequisitionStatus.DISBURSED || r.status === RequisitionStatus.APPROVED_L2
    );
    const averageTimeMinutes = approvedRequisitions.length > 0 ? 320 : 0; // Simulated stable speed in system

    return {
      totalDisbursed,
      pendingDisbursalCount,
      totalCommittedPending,
      totalActiveBudget,
      totalRemainingBudget,
      averageTimeMinutes
    };
  }, [requisitions, projects, activeYear]);

  // Calculate transaction totals by last week, this week, this month, and this year
  const timeBasedMetrics = useMemo(() => {
    const now = new Date();
    
    // 1. This Year (Jan 1st of current year)
    const startOfThisYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    
    // 2. This Month (1st of current month)
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    
    // 3. This Week (Sunday as start of current week)
    const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
    startOfThisWeek.setDate(now.getDate() - dayOfWeek);
    startOfThisWeek.setHours(0, 0, 0, 0);
    
    // 4. Last Week (Starts 7 days before startOfThisWeek, ends at startOfThisWeek)
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
    
    const endOfLastWeek = new Date(startOfThisWeek);

    // Filter requisitions that represent committed ledger transactions
    const ledgerReqs = requisitions.filter(r => 
      r.status === RequisitionStatus.APPROVED_L2 || r.status === RequisitionStatus.DISBURSED
    );

    let lastWeekTotal = 0;
    let lastWeekCount = 0;
    let thisWeekTotal = 0;
    let thisWeekCount = 0;
    let thisMonthTotal = 0;
    let thisMonthCount = 0;
    let thisYearTotal = 0;
    let thisYearCount = 0;

    ledgerReqs.forEach(req => {
      const reqDate = new Date(req.updatedAt || req.submittedAt);
      const reqTime = reqDate.getTime();
      const amount = req.amount || 0;

      // This Year
      if (reqTime >= startOfThisYear.getTime()) {
        thisYearTotal += amount;
        thisYearCount++;
      }

      // This Month
      if (reqTime >= startOfThisMonth.getTime()) {
        thisMonthTotal += amount;
        thisMonthCount++;
      }

      // This Week
      if (reqTime >= startOfThisWeek.getTime()) {
        thisWeekTotal += amount;
        thisWeekCount++;
      }

      // Last Week
      if (reqTime >= startOfLastWeek.getTime() && reqTime < endOfLastWeek.getTime()) {
        lastWeekTotal += amount;
        lastWeekCount++;
      }
    });

    return {
      lastWeek: { total: lastWeekTotal, count: lastWeekCount },
      thisWeek: { total: thisWeekTotal, count: thisWeekCount },
      thisMonth: { total: thisMonthTotal, count: thisMonthCount },
      thisYear: { total: thisYearTotal, count: thisYearCount }
    };
  }, [requisitions]);

  // Handle Budget top up directly in Database
  const handleBudgetTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProject || !topUpAmount) return;
    
    const targetBudget = parseFloat(topUpAmount);
    const targetReqLimit = parseFloat(reqLimitAmount || topUpAmount);
    const targetAccountNumber = adjustingAccountNumber.trim();
    
    if (isNaN(targetBudget) || targetBudget <= 0) {
      alert("Please enter a valid overall budget allocation amount");
      return;
    }
    if (isNaN(targetReqLimit) || targetReqLimit <= 0) {
      alert("Please enter a valid requisition limit amount");
      return;
    }
    if (!targetAccountNumber) {
      alert("Please assign a unique account number for the group budget reserve.");
      return;
    }
    if (isDuplicateAccountNumberForEdit) {
      alert(`Duplicate Account Number: "${targetAccountNumber}" is already assigned to another group reserve.`);
      return;
    }

    setTopUpLoading(true);
    try {
      await databaseService.updateProject(adjustingProject.id, {
        allocatedBudget: targetBudget,
        requisitionLimit: targetReqLimit,
        accountNumber: targetAccountNumber
      });

      await addSystemLog(
        "BUDGET_ADJUSTMENT", 
        `Adjusted: Set overall budget limit of ${adjustingProject.name} to KES ${targetBudget.toLocaleString()}, single requisition limit to KES ${targetReqLimit.toLocaleString()} and Account Number to "${targetAccountNumber}"`,
        { projectId: adjustingProject.id, newBudget: targetBudget, newRequisitionLimit: targetReqLimit, accountNumber: targetAccountNumber }
      );

      setTopUpAmount("");
      setReqLimitAmount("");
      setAdjustingAccountNumber("");
      setAdjustingProject(null);
    } catch (err) {
      console.error("Failed to adjust budget:", err);
      alert("Error writing to database. Ensure you are authorized.");
    } finally {
      setTopUpLoading(false);
    }
  };

  // Handle Manual Fund Disbursement Action
  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disbursingReq) return;

    if (!referenceNum.trim()) {
      alert("Please enter a bank transfer reference number, check or voucher id");
      return;
    }

    setIsCommitingPayout(true);

    const requester = users?.find(u => u.id === disbursingReq.requesterId);
    const resolvedEmail = requester?.email || `${disbursingReq.requesterName.toLowerCase().replace(/\s+/g, "")}@church.org`;

    // 1. Trigger Loading Email Toast
    triggerToast({
      type: "FINANCE_DISBURSEMENT",
      severity: "MEDIUM",
      message: `📧 Dispatching Cash Disbursement Email Notification to ${disbursingReq.requesterName} (${resolvedEmail})...`,
      timestamp: new Date().toISOString()
    });

    try {
      const payoutNotesText = `Disbursement ref: ${disburseMethod} #${referenceNum}. ${payoutNotes ? `Notes: ${payoutNotes}` : ""}`;
      
      // Update state to DISBURSED, which logs the decision
      await updateRequisitionStatus(
        disbursingReq.id,
        RequisitionStatus.DISBURSED,
        "APPROVE",
        payoutNotesText,
        "SIGNATURE"
      );

      await addSystemLog(
        "FUNDS_DISBURSED",
        `Disbursed KES ${disbursingReq.amount.toLocaleString()} for '${disbursingReq.title}' via ${disburseMethod} (Ref: ${referenceNum})`,
        { requisitionId: disbursingReq.id, amount: disbursingReq.amount, method: disburseMethod, referenceNum }
      );

      // 3. Trigger Success Toast
      triggerToast({
        type: "LARGE_REQUEST",
        severity: "LOW",
        message: `✅ Disbursement recorded! Notification dispatched to requester.`,
        timestamp: new Date().toISOString()
      });

      setReferenceNum("");
      setPayoutNotes("");
      setDisbursingReq(null);
    } catch (err) {
      console.error("Failed to records payout:", err);
      alert("Authorization issue or Firestore write error");
    } finally {
      setIsCommitingPayout(false);
    }
  };

  // Filtered list of requisitions specifically acting as General Ledger Line Items
  const ledgerEntries = useMemo(() => {
    return requisitions.filter(req => {
      // Must be relevant to finance: approved for payment or fully paid out
      const isFinanceTier = req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED;
      if (!isFinanceTier) return false;

      // Project filter
      if (selectedProjectId !== "ALL" && req.projectId !== selectedProjectId) return false;

      // Search term filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        req.title.toLowerCase().includes(searchLower) ||
        req.id.toLowerCase().includes(searchLower) ||
        req.groupName.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Status filters
      if (statusFilter === "PENDING_DISBURSAL" && req.status !== RequisitionStatus.APPROVED_L2) return false;
      if (statusFilter === "DISBURSED" && req.status !== RequisitionStatus.DISBURSED) return false;

      return true;
    }).sort((a, b) => {
      // Newest ledger lines first
      const dateA = new Date(a.updatedAt || a.submittedAt).getTime();
      const dateB = new Date(b.updatedAt || b.submittedAt).getTime();
      return dateB - dateA;
    });
  }, [requisitions, searchTerm, statusFilter, selectedProjectId]);

  // Double entry voucher layout generator window trigger
  const printLedgerVoucher = (req: Requisition) => {
    printRequisitionVoucher(req, currentUser);
  };

  // Export general ledger transactions to CSV for Excel/Google Sheets
  const handleDownloadCSV = async () => {
    if (!canExport) {
      alert("Permission Denied: You do not possess authority to export financial ledger reports.");
      return;
    }

    if (ledgerEntries.length === 0) {
      alert("No transaction logs found to export.");
      return;
    }

    // Define columns
    const headers = [
      "Voucher ID",
      "Title",
      "Ministry/Group",
      "Project/Account",
      "Payee/Vendor",
      "Amount (KES)",
      "Status",
      "Submitted At",
      "L1 Approved At",
      "L2 Approved At",
      "Disbursed At",
      "Requester Name",
      "Requester Email",
      "Description",
      "Fiscal Year"
    ];

    // Helper to escape CSV values
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      let str = String(val);
      // Escape double quotes by doubling them
      str = str.replace(/"/g, '""');
      // Wrap in double quotes if it contains commas, double quotes, or newlines
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str}"`;
      }
      return str;
    };

    const csvRows = [];
    csvRows.push(headers.join(","));

    for (const entry of ledgerEntries) {
      const row = [
        escapeCSV(entry.id),
        escapeCSV(entry.title),
        escapeCSV(entry.groupName),
        escapeCSV(entry.projectId || "General Budget"),
        escapeCSV(entry.payableTo || "N/A"),
        escapeCSV(entry.amount),
        escapeCSV(entry.status),
        escapeCSV(entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString() : ""),
        escapeCSV(entry.approvedAtL1 ? new Date(entry.approvedAtL1).toLocaleDateString() : ""),
        escapeCSV(entry.approvedAtL2 ? new Date(entry.approvedAtL2).toLocaleDateString() : ""),
        escapeCSV(entry.disbursedAt ? new Date(entry.disbursedAt).toLocaleDateString() : ""),
        escapeCSV(entry.requesterName),
        escapeCSV(entry.requesterEmail || "N/A"),
        escapeCSV(entry.description),
        escapeCSV(entry.fiscalYear || "")
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `PCEA_St_Andrews_Finance_Ledger_${activeYear || "Report"}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Optional system log auditing
    try {
      await addSystemLog(
        "LEDGER_EXPORT",
        `Exported general ledger transaction CSV containing ${ledgerEntries.length} lines for auditing.`,
        { exportCount: ledgerEntries.length, fiscalYear: activeYear }
      );
    } catch (e) {
      console.warn("Failed to log ledger export:", e);
    }
  };

  // Render Yearly Budgeting & Fiscal Books
  const renderYearlyBudgetingAndFiscalBooks = () => {
    return isFinanceOrAdmin && (
      <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
          <div className="space-y-1">
            <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
              <Coins size={16} className="text-primary" />
              Yearly Budgeting & Fiscal Books
            </h3>
            <p className="text-[10px] text-muted font-medium italic">Allocate yearly group budget controls and manage financial year books</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Active Year:</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-border/60 rounded-xl">
              <span className="font-mono text-xs font-extrabold text-foreground">{activeYear}</span>
              <span className={cn(
                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                yearStatus === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              )}>
                {yearStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* 2. Multi-Year Fiscal Planning & Books Management */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 rounded-[1.5rem] border border-border space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={14} className="text-primary" />
                  Multi-Year Fiscal Planning
                </h4>
                <p className="text-[10px] text-muted mt-0.5">Toggle status and manage multi-year budget horizons.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowWizard(!showWizard);
                    setShowAddFY(false);
                  }}
                  className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/25 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Wand2 size={10} />
                  {showWizard ? "Close Wizard" : "New Year Setup"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddFY(!showAddFY);
                    setShowWizard(false);
                  }}
                  className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={10} />
                  {showAddFY ? "Close Panel" : "Define FY"}
                </button>
              </div>
            </div>

            {showWizard && (
              <form onSubmit={handleRunWizard} className="p-5 bg-gradient-to-br from-emerald-500/5 to-primary/5 dark:from-emerald-950/10 dark:to-primary/10 border border-emerald-500/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Wand2 size={16} className="animate-pulse" />
                  <h5 className="text-[10px] font-black uppercase tracking-widest">New Year Budget Cloning Wizard</h5>
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  This workflow automates configuring a new financial period by cloning active group baseline structures and budget lines directly from a previous year. 
                </p>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-muted uppercase tracking-widest block font-sans">Source Year</label>
                    <select
                      value={wizardSourceYear}
                      onChange={(e) => setWizardSourceYear(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                    >
                      {fiscalYears.length > 0 ? (
                        fiscalYears.map(f => (
                          <option key={f.id} value={f.year}>FY {f.year} ({f.label})</option>
                        ))
                      ) : (
                        <option value={activeYear}>FY {activeYear} (Baseline Plan)</option>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-muted uppercase tracking-widest block font-sans">Target Year (4-digit)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2027"
                      value={wizardTargetYear}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setWizardTargetYear(v);
                        setWizardTitle(`FY ${v || ""} Budget Baseline`);
                      }}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-muted uppercase tracking-widest block font-sans">Target Year Label</label>
                  <input
                    type="text"
                    placeholder="e.g. FY 2027 Baseline Plan"
                    value={wizardTitle}
                    onChange={(e) => setWizardTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-muted uppercase tracking-widest block font-sans">Internal Notes / Rationale</label>
                  <textarea
                    rows={2}
                    placeholder="Why is this period defined?"
                    value={wizardNotes}
                    onChange={(e) => setWizardNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[10px] font-medium outline-none resize-none"
                  />
                </div>

                <div className="p-3 bg-white/40 dark:bg-card/40 border border-emerald-500/15 rounded-xl flex items-center justify-between gap-3">
                  <div className="space-y-0.5 animate-in fade-in">
                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-tight">Activate Automatically</p>
                    <p className="text-[8px] text-slate-400">Set this target year as the system active period immediately upon cloning completion.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={wizardSetActive}
                    onChange={(e) => setWizardSetActive(e.target.checked)}
                    className="w-4.5 h-4.5 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer shrink-0"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCloning}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-900/10"
                >
                  <Wand2 size={12} />
                  {isCloning ? "EXECUTING BATCH CLONE..." : "EXECUTE NEW YEAR BASELINE CLONE"}
                </button>
              </form>
            )}

            {showAddFY && (
              <form onSubmit={handleCreateFiscalYear} className="p-4 bg-white dark:bg-card border border-border rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-muted uppercase tracking-widest">Year (4-digit)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2027"
                      value={newFyYear}
                      onChange={(e) => setNewFyYear(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-muted uppercase tracking-widest">Initial Status</label>
                    <select
                      value={newFyStatus}
                      onChange={(e) => setNewFyStatus(e.target.value as "OPEN" | "CLOSED")}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-muted uppercase tracking-widest">Label / Title Description</label>
                  <input
                    type="text"
                    placeholder="e.g. FY 2027 Outreach Baseline"
                    value={newFyLabel}
                    onChange={(e) => setNewFyLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-muted uppercase tracking-widest">Planning Notes / Objectives (Optional)</label>
                  <input
                    type="text"
                    placeholder="Strategic mission expansion funds..."
                    value={newFyNotes}
                    onChange={(e) => setNewFyNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-muted uppercase tracking-widest">Start Date (Optional)</label>
                    <input
                      type="date"
                      value={newFyStartDate}
                      onChange={(e) => setNewFyStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-muted uppercase tracking-widest">End Date (Optional)</label>
                    <input
                      type="date"
                      value={newFyEndDate}
                      onChange={(e) => setNewFyEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold font-mono outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCreatingFY}
                  className="w-full py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {isCreatingFY ? "DEFINING..." : "REGISTER NEW FISCAL PERIOD"}
                </button>
              </form>
            )}

            {/* Operational Year List with Activation and Toggle Controls */}
            <div className="space-y-2.5">
              <label className="text-[8px] font-black text-muted uppercase tracking-widest">Defined Fiscal Years</label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {fiscalYears.length > 0 ? (
                  fiscalYears.map((fy) => {
                    const isActive = activeYear === fy.year;
                    return (
                      <div 
                        key={fy.id} 
                        className={cn(
                          "p-3 bg-white dark:bg-card border rounded-xl flex items-center justify-between gap-3 transition-all",
                          isActive ? "border-primary bg-primary/5 dark:bg-primary/5" : "border-border/65"
                        )}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-black text-foreground">{fy.year}</span>
                            <span className={cn(
                              "text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                              fy.status === "OPEN" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
                              fy.status === "CLOSED" && "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400",
                              fy.status === "ARCHIVED" && "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-405"
                            )}>
                              {fy.status}
                            </span>
                            {isActive && (
                              <span className="text-[7px] bg-primary text-primary-foreground font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-foreground font-bold truncate">{fy.label}</p>
                          {fy.notes && <p className="text-[8px] text-muted truncate italic mt-0.5">{fy.notes}</p>}
                          {fy.startDate && fy.endDate && (
                            <p className="text-[8px] text-slate-500 font-medium font-mono mt-0.5">
                              📅 {new Date(fy.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – {new Date(fy.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            title="Edit settings, start and end dates"
                            onClick={() => {
                              setManagingFy(fy);
                              setEditFyLabel(fy.label || "");
                              setEditFyStartDate(fy.startDate || "");
                              setEditFyEndDate(fy.endDate || "");
                              setEditFyNotes(fy.notes || "");
                            }}
                            className="p-1 px-1.5 border border-border rounded-lg text-[8px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase flex items-center gap-1 cursor-pointer"
                          >
                            <Settings size={10} />
                            Settings
                          </button>

                          {fy.status !== "ARCHIVED" ? (
                            <button
                              type="button"
                              title={`Toggle operational status to ${fy.status === "OPEN" ? "CLOSED" : "OPEN"}`}
                              onClick={() => handleToggleFYStatus(fy.id, fy.status)}
                              className="p-1 px-2 border border-border rounded-lg text-[8px] font-black text-slate-500 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase"
                            >
                              {fy.status === "OPEN" ? "Freeze" : "Open"}
                            </button>
                          ) : (
                            <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1">
                              Archived
                            </span>
                          )}

                          {fy.status === "CLOSED" && (
                            <button
                              type="button"
                              title="Archive this closed fiscal year"
                              onClick={() => handleArchiveFY(fy.id)}
                              className="p-1 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-[8px] font-black transition-colors uppercase"
                            >
                              Archive
                            </button>
                          )}

                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleSetActiveFY(fy.year)}
                              className="p-1 px-2 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 rounded-lg text-[8px] font-black transition-all uppercase"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Fallback items representing standard default structure
                  <div className="space-y-2">
                    <div className="p-3 bg-white dark:bg-card border rounded-xl flex items-center justify-between gap-3 border-primary bg-primary/5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-black text-foreground">{activeYear}</span>
                          <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {yearStatus}
                          </span>
                          <span className="text-[7px] bg-primary text-primary-foreground font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider">
                            Active
                          </span>
                        </div>
                        <p className="text-[9px] text-foreground font-bold">Standard Year {activeYear} Baseline</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleCloseYear}
                          className="p-1 px-2 border border-border rounded-lg text-[8px] font-black text-rose-600 hover:bg-rose-50"
                        >
                          {yearStatus === "OPEN" ? "FREEZE" : "OPEN"}
                        </button>
                      </div>
                    </div>

                    <div className={cn(
                      "p-3 bg-white dark:bg-card border rounded-xl flex items-center justify-between gap-3",
                      activeYear === 2027 ? "border-primary bg-primary/5" : "border-border/65"
                    )}>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-black text-foreground">2027</span>
                          <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800">
                            {activeYear === 2027 ? yearStatus : "OPEN"}
                          </span>
                          {activeYear === 2027 && (
                            <span className="text-[7px] bg-primary text-primary-foreground font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-foreground font-bold">Strategic Outreach Expansion Plan</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {activeYear === 2027 && (
                          <button
                            type="button"
                            onClick={handleCloseYear}
                            className="p-1 px-2 border border-border rounded-lg text-[8px] font-black text-rose-600 hover:bg-rose-50"
                          >
                            {yearStatus === "OPEN" ? "FREEZE" : "OPEN"}
                          </button>
                        )}
                        {activeYear !== 2027 && (
                          <button
                            type="button"
                            onClick={() => handleOpenNextYear()}
                            className="p-1 px-2 bg-primary/10 text-primary rounded-lg text-[8px] font-black"
                          >
                            ACTIVATE / OPEN
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Global General Church Ledger Close-off Authorization */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 rounded-[1.5rem] border border-border space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest px-2.5 py-1 bg-amber-500/10 rounded-full border border-amber-500/20 w-fit block font-mono">
                System Administrator Operations
              </span>
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-primary" />
                Authored Ledger Closeout protocol
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Freezing the financial calendar secures all transactions, baseline budget lines, allocations and disbursement histories. No new requisitions or adjustments can be posted by group contributors or fiscal offices during closure. 
              </p>
              
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1.5">
                <span className="text-[8px] font-bold text-amber-600 uppercase tracking-wider block font-sans">IMPORTANT CLARIFICATION NOTICE:</span>
                <p className="text-[9px] text-slate-500 leading-normal">
                  Locking the year requires administrative authorization. Re-establishing access can only be executed by Super Admins or authorized Chief Finance Officers.
                </p>
              </div>
            </div>

            <div className="pt-4 divide-y divide-border/40">
              <div className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-foreground uppercase tracking-tight">Active Horizon status</p>
                  <p className="text-[9px] text-slate-400">Current active window is {yearStatus}</p>
                </div>
                
                <button
                  type="button"
                  onClick={handleToggleYearClosure}
                  className={cn(
                    "px-4.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                    yearStatus === "OPEN" 
                      ? "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/15" 
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/15"
                  )}
                >
                  <Lock size={11} />
                  {yearStatus === "OPEN" ? "FREEZE TRANSACTIONS" : "RE-OPEN YEAR ACTIVE STATUS"}
                </button>
              </div>


              <div className="pt-3.5">
                <p className="text-[8px] font-medium text-muted italic text-center leading-normal">
                  💡 Use the "Define FY" button above to dynamically save customizable financial horizons into Firestore.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in transition-all duration-700">
      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
      {/* 1. Brand Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Finance Ledger</h1>
          <p className="text-slate-500 text-sm">Double-entry ledger ledger checking, budget allocations, and disbursement controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#4f46e5]/95 bg-[#4f46e5]/10 px-3 py-1 rounded-full border border-indigo-500/10">
            Accounting Console
          </span>
        </div>
      </div>

      <GlobalFiscalOverview 
        projects={projects}
        activeYear={systemSettings?.currentFiscalYear}
        status={systemSettings?.fiscalYearStatus}
      />

      {/* Time Horizon Transaction Volume Card Row */}
      <div id="ledger-time-horizon-container" className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Calendar size={15} strokeWidth={2.5} />
            </div>
            <div>
              <h3 id="time-horizon-header-title" className="text-xs font-black text-slate-800 uppercase tracking-widest">
                Committed Ledger Volumes
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Consolidated totals from approved & disbursed vouchers
              </p>
            </div>
          </div>
          <span className="text-[9px] font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md font-bold self-start sm:self-center">
            REAL-TIME CALENDAR CALCULATION
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Last Week */}
          <div id="metric-last-week-card" className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between group hover:border-indigo-100 transition-all hover:bg-white">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">
              Last Week
            </span>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-800 tracking-tight font-mono">
                {formatCurrency(timeBasedMetrics.lastWeek.total)}
              </h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                {timeBasedMetrics.lastWeek.count} approved voucher{timeBasedMetrics.lastWeek.count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* This Week */}
          <div id="metric-this-week-card" className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-500/15 flex flex-col justify-between group hover:border-indigo-300 transition-all hover:bg-indigo-50/50">
            <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-widest block mb-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
              This Week
            </span>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-indigo-900 tracking-tight font-mono">
                {formatCurrency(timeBasedMetrics.thisWeek.total)}
              </h4>
              <p className="text-[9px] text-indigo-500/80 font-bold uppercase tracking-wider">
                {timeBasedMetrics.thisWeek.count} active voucher{timeBasedMetrics.thisWeek.count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* This Month */}
          <div id="metric-this-month-card" className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-500/15 flex flex-col justify-between group hover:border-emerald-300 transition-all hover:bg-emerald-50/50">
            <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest block mb-1">
              This Month
            </span>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-emerald-950 tracking-tight font-mono">
                {formatCurrency(timeBasedMetrics.thisMonth.total)}
              </h4>
              <p className="text-[9px] text-emerald-600/80 font-bold uppercase tracking-wider">
                {timeBasedMetrics.thisMonth.count} voucher{timeBasedMetrics.thisMonth.count !== 1 ? "s" : ""} logged
              </p>
            </div>
          </div>

          {/* This Year */}
          <div id="metric-this-year-card" className="bg-blue-50/30 p-4 rounded-2xl border border-blue-500/15 flex flex-col justify-between group hover:border-blue-300 transition-all hover:bg-blue-50/50">
            <span className="text-[9px] font-extrabold text-blue-600 uppercase tracking-widest block mb-1">
              This Fiscal Year
            </span>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-blue-950 tracking-tight font-mono">
                {formatCurrency(timeBasedMetrics.thisYear.total)}
              </h4>
              <p className="text-[9px] text-blue-600/80 font-bold uppercase tracking-wider">
                {timeBasedMetrics.thisYear.count} cumulative voucher{timeBasedMetrics.thisYear.count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Fiscal Analytics Deck */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div id="metric-total-allocated-budget-card" className="bg-slate-900 p-5 rounded-2xl text-white border border-slate-800 shadow-md relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-125 transition-all text-indigo-400">
            <Building2 size={80} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-between">
            Total Allocated Ministry Group Budget
          </p>
          <h2 className="text-xl font-bold leading-none mb-2">{formatCurrency(metrics.totalActiveBudget)}</h2>
          <div className="flex items-center gap-1.5 text-[9px] font-semibold text-emerald-400">
            <Building2 size={10} />
            <span>Sum of All Ministry Allocations (FY {activeYear})</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:scale-125 transition-all text-amber-500">
            <Clock size={80} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Committed Liabilities</p>
          <h2 className="text-xl font-bold text-slate-900 leading-none mb-2">{formatCurrency(metrics.totalCommittedPending)}</h2>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full inline-flex">
            <span>{metrics.pendingDisbursalCount} Approved, Awaiting Payout</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:scale-125 transition-all text-[#10b981]">
            <CheckCircle2 size={80} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Fund Disbursed</p>
          <h2 className="text-xl font-bold text-slate-900 leading-none mb-2">{formatCurrency(metrics.totalDisbursed)}</h2>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex">
            <ArrowDownLeft size={10} />
            <span>Actual Outflows Recorded</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:scale-125 transition-all text-[#4f46e5]">
            <TrendingUp size={80} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Budget Safety Margin</p>
          <h2 className="text-xl font-bold text-slate-900 leading-none mb-2">{formatCurrency(metrics.totalRemainingBudget)}</h2>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-flex">
            <span>Unspent Budget Pool</span>
          </div>
        </div>

      </div>

      {/* 3. Navigation between ledger journal vs. project budgets */}
      <div className="flex border-b border-slate-200 gap-6">
        {isFinanceOrAdmin && (
          <button
            onClick={() => setActiveTab("ledgers")}
            className={cn(
              "pb-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer",
              activeTab === "ledgers" ? "border-indigo-600 text-indigo-600 font-extrabold" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            General Ledger Logs
          </button>
        )}
        <button
          onClick={() => setActiveTab("budgets")}
          className={cn(
            "pb-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer",
            activeTab === "budgets" ? "border-indigo-600 text-indigo-600 font-extrabold" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          {isFinanceOrAdmin ? "Ministry Budget Controls" : "Ministry Budget Allocations"}
        </button>
      </div>

      {activeTab === "ledgers" && (
        <div className="space-y-6">
          
          {/* Project Budget Quick-View Cards */}
          <div className="flex gap-3 overflow-x-auto pb-4 pt-1 -mx-2 px-2 scrollbar-hide">
            {projects.map((project) => {
              const projectRequisitions = getProjectRequisitions(project, requisitions);
              const requisitionsCount = projectRequisitions.length;
              const usedAmount = projectRequisitions
                .filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED].includes(r.status))
                .reduce((sum, r) => sum + r.amount, 0);
              const spendingRatio = (usedAmount / project.allocatedBudget) * 100;
              const remainingAmount = project.allocatedBudget - usedAmount;
              return (
                <div 
                  key={project.id} 
                  className="min-w-[180px] md:min-w-[220px] bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-2 group cursor-pointer"
                  onClick={() => {
                    setSelectedProjectId(project.id);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-tight group-hover:text-indigo-600 transition-colors truncate max-w-[140px]">
                        {project.name}
                      </h4>
                      <p className="text-[8px] font-mono text-slate-400">Remaining: {formatCurrency(remainingAmount)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded-full border",
                        spendingRatio >= 90 
                          ? "bg-rose-50 text-rose-600 border-rose-100" 
                          : spendingRatio >= 75 
                            ? "bg-amber-50 text-amber-600 border-amber-100" 
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                      )}>
                        {spendingRatio.toFixed(0)}% Used
                      </span>
                      {requisitionsCount > 0 && (
                        <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 shadow-sm">
                          {requisitionsCount} REQs
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(spendingRatio, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full",
                          spendingRatio >= 90 ? "bg-rose-500" : spendingRatio >= 75 ? "bg-amber-500" : "bg-indigo-600"
                        )}
                      />
                    </div>
                    <div className="flex justify-between text-[7px] font-bold text-slate-400 tracking-tighter">
                      <span>{formatCurrency(usedAmount)}</span>
                      <span>{formatCurrency(project.allocatedBudget)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. Filter Panel */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
              <button 
                onClick={() => setStatusFilter("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                  statusFilter === "ALL" 
                    ? "bg-slate-900 text-white" 
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                )}
              >
                All Entries
              </button>
              <button 
                onClick={() => setStatusFilter("PENDING_DISBURSAL")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  statusFilter === "PENDING_DISBURSAL" 
                    ? "bg-amber-500 text-white" 
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                <Clock size={12} />
                Pending Disbursal ({metrics.pendingDisbursalCount})
              </button>
              <button 
                onClick={() => setStatusFilter("DISBURSED")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  statusFilter === "DISBURSED" 
                    ? "bg-emerald-600 text-white" 
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                )}
              >
                <CheckCircle2 size={12} />
                Disbursed Logs
              </button>
            </div>

            <div className="flex gap-2 items-center w-full lg:w-auto">
              {/* Search */}
              <div className="relative flex-1 lg:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter key words or voucher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Project selector */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/10"
              >
                <option value="ALL">All Accounts</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* Export CSV Button */}
              {canExport && (
                <button
                  onClick={handleDownloadCSV}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs rounded-lg px-3 py-1.5 font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Export current filtered ledger logs to CSV"
                >
                  <Download size={13} strokeWidth={2.5} />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* 5. Awaiting Disbursement Box */}
          {requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2).length > 0 && (
            <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-5 space-y-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-amber-600" size={18} />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Payout Queue ({metrics.pendingDisbursalCount})</h3>
                    <p className="text-[10px] text-slate-500">Authorized requests ready for immediate payment processing.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2).map((req) => (
                  <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">#{req.id.substr(0, 8)}</span>
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={10} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-extrabold text-[#4f46e5]">{formatCurrency(req.amount)}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">{req.title}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Group: {req.groupName} • Requester: {req.requesterName}</p>
                    </div>

                    <button
                      onClick={() => setDisbursingReq(req)}
                      className="w-full text-center py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Process Disbursement Voucher
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Active double entry bookkeeping journal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Double-Entry Ledger Books</h3>
                <p className="text-[10px] text-slate-500">Every payout and reserve commitment balance ledger transaction.</p>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">
                Showing {ledgerEntries.length} entries
              </div>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Database className="mx-auto text-slate-300" size={32} />
                <p className="text-xs font-medium">No financial ledger entries found matching the filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-6">Voucher/Code</th>
                      <th className="py-3 px-4">Account Allocation Context</th>
                      <th className="py-3 px-4 text-right">Debit (Econ)</th>
                      <th className="py-3 px-4 text-right">Credit (Asset)</th>
                      <th className="py-3 px-4">Status & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {ledgerEntries.map((req) => {
                      const isExpanded = expandedReqId === req.id;
                      const codeInfo = getAccountingCode(req.groupId);
                      return (
                        <React.Fragment key={req.id}>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 font-mono">
                              <div className="text-[11px] font-bold text-slate-800">#{req.id.substr(0, 8).toUpperCase()}</div>
                              <div className="text-[9px] text-slate-400 uppercase tracking-wider">Acc: {codeInfo.code}</div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <span className="line-clamp-1">{req.title}</span>
                                {req.flaggedForAudit && (
                                  <span title="Flagged for Audit" className="inline-flex shrink-0">
                                    <Flag size={11} className="text-rose-500 fill-rose-500" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                <span className="font-bold text-indigo-600">{req.groupName}</span>
                                <span>•</span>
                                <span>Project: {projects.find(p => p.id === req.projectId)?.name || "Central Reserve"}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right font-mono font-bold text-rose-600">
                              KES {req.amount.toLocaleString()}.00
                            </td>
                            <td className="py-4 px-4 text-right font-mono font-medium text-slate-400">
                              - Credit Central Bank
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block",
                                  req.status === RequisitionStatus.DISBURSED 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                    : "bg-amber-50 text-amber-700 border border-amber-100"
                                )}>
                                  {req.status === RequisitionStatus.DISBURSED ? "PAID OUT" : "UNPAID REQ"}
                                </span>
                                
                                <button
                                  onClick={() => printLedgerVoucher(req)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                                  title="Print Cash Disbursement Voucher"
                                >
                                  <Printer size={13} />
                                </button>

                                <button
                                  onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors cursor-pointer"
                                >
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Extra transaction journal notes */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="bg-slate-50/50 p-4 border-t border-b border-dashed border-slate-200">
                                <div className="space-y-2 text-[11px] text-slate-600">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-[10px]">
                                    <div>
                                      <span className="font-bold text-slate-400 uppercase block">Requester Details</span>
                                      <p className="font-semibold text-slate-900">{req.requesterName}</p>
                                      <p className="text-slate-500 font-mono">{req.requesterEmail || users?.find(u => u.id === req.requesterId)?.email || `${req.requesterName.toLowerCase().replace(/\s+/g, "")}@church.org`}</p>
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-400 uppercase block">Group / Beneficiary</span>
                                      <p className="font-semibold text-slate-900">{req.groupName}</p>
                                      {req.payableTo && <p className="text-slate-600">Payable To: <strong>{req.payableTo}</strong></p>}
                                    </div>
                                  </div>

                                  <p><strong>Accounting Narrative:</strong> {req.description || "No description provided."}</p>
                                  {req.amountWords && <p><strong>Amount in Words:</strong> {req.amountWords}</p>}
                                  
                                  <div className="flex flex-wrap gap-4 pt-2 text-[10px] text-slate-500 border-t border-slate-200">
                                    <p><strong>Submitted Date:</strong> {req.submittedAt ? new Date(req.submittedAt).toLocaleString() : "N/A"}</p>
                                    <p><strong>Approved Date L1:</strong> {req.approvedAtL1 ? new Date(req.approvedAtL1).toLocaleString() : "N/A"}</p>
                                    <p><strong>Approved Date L2:</strong> {req.approvedAtL2 ? new Date(req.approvedAtL2).toLocaleString() : "N/A"}</p>
                                    {req.status === RequisitionStatus.DISBURSED && (
                                      <p className="text-emerald-700 font-semibold">
                                        <strong>Fully Settled Date:</strong> {req.disbursedAt ? new Date(req.disbursedAt).toLocaleString() : new Date(req.updatedAt).toLocaleString()}
                                      </p>
                                    )}
                                  </div>

                                  {Array.isArray(req.approvalHistory) && req.approvalHistory.length > 0 && (
                                    <div className="space-y-1 pt-2">
                                      <p className="font-bold text-slate-700">Audit Chamber Protocol Logs & Approver Trail:</p>
                                      <div className="space-y-1">
                                        {req.approvalHistory.map((h, i) => (
                                          <p key={i} className="font-mono text-[9px] text-slate-600 bg-white p-1.5 rounded-md border border-slate-200 flex justify-between items-center">
                                            <span>[{new Date(h.timestamp).toLocaleTimeString()}] [{h.role}] <strong>{h.approverName}</strong> ({h.method}): "{h.note || "No custom ledger notes provided"}"</span>
                                            <span className={h.decision === "APPROVE" ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>{h.decision}</span>
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}



      {activeTab === "budgets" && (
        <div className="space-y-6">
          
          {/* Yearly Budgeting & Financial Books Closing section deactivated from top block (moved to bottom) */}
          {false && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm p-8 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Coins size={16} className="text-primary" />
                    Yearly Budgeting & Fiscal Books
                  </h3>
                  <p className="text-[10px] text-muted font-medium italic">Allocate yearly group budget controls and manage financial year books</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Active Year:</span>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-border/60 rounded-xl">
                    <span className="font-mono text-xs font-extrabold text-foreground">{activeYear}</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                      yearStatus === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    )}>
                      {yearStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* 2. Multi-Year Fiscal Planning & Books Management */}
                <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 rounded-[1.5rem] border border-border space-y-6">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                      <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen size={14} className="text-primary" />
                        Multi-Year Fiscal Planning
                      </h4>
                      <p className="text-[10px] text-muted mt-0.5">Toggle status and manage multi-year budget horizons.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowWizard(!showWizard);
                          setShowAddFY(false);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/25 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Wand2 size={10} />
                        {showWizard ? "Close Wizard" : "New Year Setup"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAddFY(!showAddFY);
                          setShowWizard(false);
                        }}
                        className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={10} />
                        {showAddFY ? "Close Panel" : "Define FY"}
                      </button>
                    </div>
                  </div>

                  {showWizard && (
                    <form onSubmit={handleRunWizard} className="p-5 bg-gradient-to-br from-emerald-500/5 to-primary/5 dark:from-emerald-950/10 dark:to-primary/10 border border-emerald-500/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <Wand2 size={16} className="animate-pulse" />
                        <h5 className="text-[10px] font-black uppercase tracking-widest">New Year Budget Cloning Wizard</h5>
                      </div>

                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        This workflow automates configuring a new financial period by cloning active group baseline structures and budget lines directly from a previous year. 
                      </p>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-muted uppercase tracking-widest block font-sans">Source Year</label>
                          <select
                            value={wizardSourceYear}
                            onChange={(e) => setWizardSourceYear(parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                          >
                            {fiscalYears.length > 0 ? (
                              fiscalYears.map(f => (
                                <option key={f.id} value={f.year}>FY {f.year} ({f.label})</option>
                              ))
                            ) : (
                              <option value={activeYear}>FY {activeYear} (Baseline Plan)</option>
                            )}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-muted uppercase tracking-widest block font-sans">Target Year (4-digit)</label>
                          <input
                            type="number"
                            placeholder="e.g. 2027"
                            value={wizardTargetYear}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setWizardTargetYear(v);
                              setWizardTitle(`FY ${v || ""} Budget Baseline`);
                            }}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-muted uppercase tracking-widest block font-sans">Target Year Label</label>
                        <input
                          type="text"
                          placeholder="e.g. FY 2027 Baseline Plan"
                          value={wizardTitle}
                          onChange={(e) => setWizardTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-muted uppercase tracking-widest block font-sans">Internal Notes / Rationale</label>
                        <textarea
                          rows={2}
                          placeholder="Why is this period defined?"
                          value={wizardNotes}
                          onChange={(e) => setWizardNotes(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[10px] font-medium outline-none resize-none"
                        />
                      </div>

                      <div className="p-3 bg-white/40 dark:bg-card/40 border border-emerald-500/15 rounded-xl flex items-center justify-between gap-3">
                        <div className="space-y-0.5 animate-in fade-in">
                          <p className="text-[9px] font-black text-slate-700 uppercase tracking-tight">Activate Automatically</p>
                          <p className="text-[8px] text-slate-400">Set this target year as the system active period immediately upon cloning completion.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={wizardSetActive}
                          onChange={(e) => setWizardSetActive(e.target.checked)}
                          className="w-4.5 h-4.5 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer shrink-0"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isCloning}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-900/10"
                      >
                        <Wand2 size={12} />
                        {isCloning ? "EXECUTING BATCH CLONE..." : "EXECUTE NEW YEAR BASELINE CLONE"}
                      </button>
                    </form>
                  )}

                  {showAddFY && (
                    <form onSubmit={handleCreateFiscalYear} className="p-4 bg-white dark:bg-card border border-border rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-muted uppercase tracking-widest">Year (4-digit)</label>
                          <input
                            type="number"
                            placeholder="e.g. 2027"
                            value={newFyYear}
                            onChange={(e) => setNewFyYear(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-muted uppercase tracking-widest">Initial Status</label>
                          <select
                            value={newFyStatus}
                            onChange={(e) => setNewFyStatus(e.target.value as "OPEN" | "CLOSED")}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                          >
                            <option value="OPEN">OPEN</option>
                            <option value="CLOSED">CLOSED</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-muted uppercase tracking-widest">Label / Title Description</label>
                        <input
                          type="text"
                          placeholder="e.g. FY 2027 Outreach Baseline"
                          value={newFyLabel}
                          onChange={(e) => setNewFyLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-muted uppercase tracking-widest">Planning Notes / Objectives (Optional)</label>
                        <input
                          type="text"
                          placeholder="Strategic mission expansion funds..."
                          value={newFyNotes}
                          onChange={(e) => setNewFyNotes(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-[11px] font-bold outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isCreatingFY}
                        className="w-full py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors"
                      >
                        {isCreatingFY ? "DEFINING..." : "REGISTER NEW FISCAL PERIOD"}
                      </button>
                    </form>
                  )}

                  {/* Operational Year List with Activation and Toggle Controls */}
                  <div className="space-y-2.5">
                    <label className="text-[8px] font-black text-muted uppercase tracking-widest">Defined Fiscal Years</label>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {fiscalYears.length > 0 ? (
                        fiscalYears.map((fy) => {
                          const isActive = activeYear === fy.year;
                          return (
                            <div 
                              key={fy.id} 
                              className={cn(
                                "p-3 bg-white dark:bg-card border rounded-xl flex items-center justify-between gap-3 transition-all",
                                isActive ? "border-primary bg-primary/5 dark:bg-primary/5" : "border-border/65"
                              )}
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[11px] font-black text-foreground">{fy.year}</span>
                                  <span className={cn(
                                    "text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                                    fy.status === "OPEN" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
                                    fy.status === "CLOSED" && "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400",
                                    fy.status === "ARCHIVED" && "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                                  )}>
                                    {fy.status}
                                  </span>
                                  {isActive && (
                                    <span className="text-[7px] bg-primary text-primary-foreground font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9px] text-foreground font-bold truncate">{fy.label}</p>
                                {fy.notes && <p className="text-[8px] text-muted truncate italic mt-0.5">{fy.notes}</p>}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {fy.status !== "ARCHIVED" ? (
                                  <button
                                    type="button"
                                    title={`Toggle operational status to ${fy.status === "OPEN" ? "CLOSED" : "OPEN"}`}
                                    onClick={() => handleToggleFYStatus(fy.id, fy.status)}
                                    className="p-1 px-2 border border-border rounded-lg text-[8px] font-black text-slate-500 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase"
                                  >
                                    {fy.status === "OPEN" ? "Freeze" : "Open"}
                                  </button>
                                ) : (
                                  <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1">
                                    Archived
                                  </span>
                                )}

                                {fy.status === "CLOSED" && (
                                  <button
                                    type="button"
                                    title="Archive this closed fiscal year"
                                    onClick={() => handleArchiveFY(fy.id)}
                                    className="p-1 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-[8px] font-black transition-colors uppercase"
                                  >
                                    Archive
                                  </button>
                                )}

                                {!isActive && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetActiveFY(fy.year)}
                                    className="p-1 px-2 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 rounded-lg text-[8px] font-black transition-all uppercase"
                                  >
                                    Activate
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        // Fallback items representing standard default structure
                        <div className="space-y-2">
                          {[
                            { year: activeYear, label: `Standard Year ${activeYear} Baseline`, status: yearStatus, active: true },
                            { year: activeYear + 1, label: `Strategic Outreach Expansion Plan`, status: "OPEN", active: false }
                          ].map((item) => {
                            const isCurrent = item.active;
                            return (
                              <div key={item.year} className={cn(
                                "p-3 bg-white dark:bg-card border rounded-xl flex items-center justify-between gap-3",
                                isCurrent ? "border-primary bg-primary/5" : "border-border/65"
                              )}>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[11px] font-black text-foreground">{item.year}</span>
                                    <span className={cn(
                                      "text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                                      isCurrent ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800 dark:bg-slate-800"
                                    )}>
                                      {item.status}
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[7px] bg-primary text-primary-foreground font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-foreground font-bold">{item.label}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  {isCurrent ? (
                                    <button
                                      type="button"
                                      onClick={handleCloseYear}
                                      className="p-1 px-2 border border-border rounded-lg text-[8px] font-black text-rose-600 hover:bg-rose-50"
                                    >
                                      {yearStatus === "OPEN" ? "FREEZE" : "OPEN"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenNextYear()}
                                      className="p-1 px-2 bg-primary/10 text-primary rounded-lg text-[8px] font-black"
                                    >
                                      ACTIVATE / OPEN
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          <p className="text-[8px] font-medium text-muted italic text-center leading-normal">
                            💡 Use the "Define FY" button above to dynamically save customizable financial horizons into Firestore.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Budget allocation form */}
          {isFinanceOrAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Ministry Budget Controls */}
              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 lg:col-span-12">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Coins size={16} className="text-indigo-600" />
                      Allocate Group Budget Limits
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Ministry Budget Control & baseline reserve allocation</p>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    FY {activeYear}
                  </span>
                </div>

                <form onSubmit={handleAllocateBudget} className="space-y-4">
                  <div className="space-y-2 relative">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Group / Ministry</label>
                    
                    <div className="relative">
                      <input
                        disabled={yearStatus === "CLOSED" && currentUser?.role !== UserRole.SUPER_ADMIN}
                        type="text"
                        placeholder="Type to search church groups/ministries..."
                        value={groupSearchQuery}
                        onChange={(e) => {
                          setGroupSearchQuery(e.target.value);
                          setSelectedGroupId(""); // Force re-selection
                          setIsGroupDropdownOpen(true);
                        }}
                        onFocus={() => setIsGroupDropdownOpen(true)}
                        className="w-full px-4 py-3 bg-slate-550/5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
                      />
                      {groupSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setGroupSearchQuery("");
                            setSelectedGroupId("");
                          }}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 p-1 hover:bg-slate-200/50 rounded-full"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Backdrop for click outside */}
                    {isGroupDropdownOpen && (
                      <div className="fixed inset-0 z-30" onClick={() => setIsGroupDropdownOpen(false)} />
                    )}

                    {/* Autocomplete Dropdown List */}
                    <AnimatePresence>
                      {isGroupDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute z-40 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-150"
                        >
                          {filteredGroups.length > 0 ? (
                            filteredGroups.map(cg => {
                              // Check if this group already has a budget allocation for activeYear
                              const activeAllocation = projects.find(p => p.groupId === cg.name && p.fiscalYear === activeYear);
                              const hasActiveAllocation = activeAllocation && activeAllocation.allocatedBudget > 0;
                              
                              return (
                                <button
                                  key={cg.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedGroupId(cg.name);
                                    setGroupSearchQuery(cg.name);
                                    setIsGroupDropdownOpen(false);

                                    // Suggest a default unique accounting code
                                    const existingProjectWithCode = projects.find(p => p.groupId === cg.name && p.accountNumber);
                                    if (existingProjectWithCode) {
                                      setAllocationAccountNumber(existingProjectWithCode.accountNumber || "");
                                    } else {
                                      const defCode = getAccountingCode(cg.name).code;
                                      let finalCode = defCode;
                                      let suffix = 1;
                                      while (projects.some(p => p.accountNumber === finalCode)) {
                                        finalCode = `${defCode}-${suffix}`;
                                        suffix++;
                                      }
                                      setAllocationAccountNumber(finalCode);
                                    }
                                  }}
                                  className={cn(
                                    "w-full px-4 py-3 text-left hover:bg-slate-550/5 hover:text-indigo-600 transition-colors flex flex-col gap-0.5",
                                    selectedGroupId === cg.name && "bg-indigo-50/50"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{cg.name}</span>
                                    {hasActiveAllocation ? (
                                      <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-250">
                                        KES {activeAllocation.allocatedBudget.toLocaleString()} Alloc
                                      </span>
                                    ) : (
                                      <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                        No current limit
                                      </span>
                                    )}
                                  </div>
                                  {cg.description && (
                                    <span className="text-[9px] text-slate-500 font-medium line-clamp-1">{cg.description}</span>
                                  )}
                                </button>
                              );
                            })
                          ) : (
                            <div className="p-4 text-center space-y-2">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">No church groups found matching "{groupSearchQuery}"</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedGroupId(groupSearchQuery);
                                  setIsGroupDropdownOpen(false);

                                  const existingProjectWithCode = projects.find(p => p.groupId === groupSearchQuery && p.accountNumber);
                                  if (existingProjectWithCode) {
                                    setAllocationAccountNumber(existingProjectWithCode.accountNumber || "");
                                  } else {
                                    const defCode = "4090";
                                    let finalCode = defCode;
                                    let suffix = 1;
                                    while (projects.some(p => p.accountNumber === finalCode)) {
                                      finalCode = `${defCode}-${suffix}`;
                                      suffix++;
                                    }
                                    setAllocationAccountNumber(finalCode);
                                  }
                                }}
                                className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors rounded-lg text-[9px] font-black uppercase tracking-wider"
                              >
                                Use "{groupSearchQuery}" as custom group name anyway
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {selectedGroupId && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 self-start"
                        >
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          Selected: {selectedGroupId}
                        </motion.div>

                        {isDuplicateGroup && (
                          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10.5px] text-rose-800 font-black uppercase tracking-wide space-y-1">
                            <p>⚠️ Duplicate Ministry Reserve Detected</p>
                            <p className="text-[9.5px] font-medium text-rose-700 normal-case leading-relaxed">
                              A budget reserve for "{selectedGroupId}" already exists for FY {activeYear}. Multiple direct lines for the same ministry group are blocked to preserve double-entry integrity. Please adjust the existing reserve limit below instead, or choose/type a unique group.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {yearStatus === "CLOSED" && currentUser?.role === UserRole.SUPER_ADMIN && (
                      <p className="text-[9px] text-amber-600 font-bold">⚠️ Warning: Fiscal Year books are CLOSED. Super Admin override enabled.</p>
                    )}
                  </div>

                  {prevYearData && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div>
                        <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">FY {prevYear} Allocated</p>
                        <p className="text-xs font-bold text-indigo-900">{formatCurrency(prevYearData.allocated)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">FY {prevYear} Used</p>
                        <p className="text-xs font-bold text-indigo-900">{formatCurrency(prevYearData.used)}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Unique Account Number</label>
                    <input
                      disabled={yearStatus === "CLOSED" && currentUser?.role !== UserRole.SUPER_ADMIN}
                      type="text"
                      placeholder="e.g. 4010-B or 4022"
                      value={allocationAccountNumber}
                      onChange={(e) => setAllocationAccountNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-600 outline-none transition-colors"
                    />
                    {allocationAccountNumber && !isDuplicateAccountNumber && (
                      <p className="text-[9.5px] text-emerald-700 font-bold ml-1">
                        ✅ Custom Account Code "{allocationAccountNumber}" is unique and available.
                      </p>
                    )}
                    {isDuplicateAccountNumber && (
                      <p className="text-rose-500 text-[9.5px] font-black uppercase tracking-wide ml-1">
                        ⚠️ Duplicate Account Code: "{allocationAccountNumber}" is already assigned to another ministry group reserve!
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Allocation Limit (KES)</label>
                    <input
                      disabled={yearStatus === "CLOSED" && currentUser?.role !== UserRole.SUPER_ADMIN}
                      type="text"
                      placeholder="e.g. 500,000"
                      value={allocationAmount}
                      onChange={handleAmountChange}
                      className="w-full px-4 py-3 bg-slate-550/5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-600 outline-none transition-colors font-mono"
                    />
                    {allocationAmount && (
                      <motion.div 
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-500 font-medium flex items-start gap-2 animate-fadeIn"
                      >
                        <Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Amount in Words</span>
                          <p className="font-bold text-slate-700 italic">
                            {numberToWords(allocationAmount)}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isAllocating || isDuplicateGroup || isDuplicateAccountNumber || (yearStatus === "CLOSED" && currentUser?.role !== UserRole.SUPER_ADMIN)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    {isAllocating ? "ALLOCATING..." : "SAVE BUDGET LIMIT"}
                  </button>
                </form>
              </section>
            </div>
          )}

          {/* 7. Active progress dashboard */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">Ministry Group Budget Reserves</h3>
                <p className="text-xs text-slate-500">Live fiscal matrix mapping allocations, spend trails, and unallocated buffer transactions.</p>
              </div>
              <div className="w-full md:w-80">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search reserves by name or account..."
                    value={reservesSearchQuery}
                    onChange={(e) => {
                      setReservesSearchQuery(e.target.value);
                      setReservesPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-bold outline-none transition-colors"
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  {reservesSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setReservesSearchQuery("");
                        setReservesPage(1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {paginatedProjects.length > 0 ? (
                paginatedProjects.map((project) => {
                  const projectRequisitions = getProjectRequisitions(project, requisitions);
                  const requisitionsCount = projectRequisitions.length;
                  
                  const disbursedAmount = projectRequisitions.filter(r => r.status === RequisitionStatus.DISBURSED).reduce((sum, r) => sum + r.amount, 0);
                  const pendingReqs = projectRequisitions.filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2].includes(r.status));
                  const pendingAmount = pendingReqs.reduce((sum, r) => sum + r.amount, 0);

                  const totalCommitted = disbursedAmount + pendingAmount;
                  const remainingAmount = project.allocatedBudget - totalCommitted;

                  const disbursedRatio = (disbursedAmount / project.allocatedBudget) * 100;
                  const pendingRatio = (pendingAmount / project.allocatedBudget) * 100;
                  const totalRatio = (totalCommitted / project.allocatedBudget) * 100;

                  const codeInfo = getAccountingCode(project.groupId);

                  return (
                    <div key={project.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all bg-slate-50/30">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                              ACC: {project.accountNumber || codeInfo.code}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{project.name}</h4>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">Linked Group ID: {project.groupId} • Status: {project.status}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actual Spent</div>
                            <div className="text-xs font-bold text-emerald-600">
                              {formatCurrency(disbursedAmount)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Committed vs. Allocated</div>
                            <div className="text-xs font-bold text-slate-800">
                              {formatCurrency(totalCommitted)} <span className="text-slate-400 font-medium">/ {formatCurrency(project.allocatedBudget)}</span>
                            </div>
                          </div>

                          {isFinanceOrAdmin && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setAdjustingProject(project)}
                                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-indigo-600 text-slate-700 hover:text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Plus size={10} />
                                Modify
                              </button>
                              <button
                                onClick={() => handleDeleteProjectBudget(project)}
                                className="px-2.5 py-1.5 bg-rose-50 border border-rose-100 hover:border-rose-600 text-rose-700 hover:text-rose-650 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                title="Delete Reserve"
                              >
                                <X size={10} className="shrink-0" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 flex">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000",
                              totalRatio >= 90 ? "bg-rose-600" : "bg-indigo-600"
                            )}
                            style={{ width: `${Math.min(disbursedRatio, 100)}%` }}
                            title={`Disbursed: ${formatCurrency(disbursedAmount)}`}
                          />
                          <div 
                            className="h-full bg-amber-400 transition-all duration-1000 shadow-[inset_0_0_8px_rgba(0,0,0,0.1)]"
                            style={{ width: `${Math.min(pendingRatio, 100 - (isNaN(disbursedRatio) ? 0 : disbursedRatio))}%` }}
                            title={`Pending: ${formatCurrency(pendingAmount)}`}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold">
                          <div className="flex items-center gap-2">
                            <span>{totalRatio.toFixed(1)}% Bound</span>
                            {pendingAmount > 0 && (
                              <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200 text-[8px] uppercase ring-1 ring-amber-400/20">
                                {formatCurrency(pendingAmount)} Pending
                              </span>
                            )}
                            {requisitionsCount > 0 && (
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 text-[8px] uppercase">
                                {requisitionsCount} Reqs
                              </span>
                            )}
                            <span className="bg-slate-105 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[8px] uppercase font-mono">
                              REQ LIMIT: {formatCurrency(project.requisitionLimit || project.allocatedBudget)}
                            </span>
                          </div>
                          <span>{formatCurrency(remainingAmount)} Remaining Reserve</span>
                        </div>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest border border-dashed border-slate-200 rounded-xl">
                  No budget reserves found matching dynamic query
                </div>
              )}

              {totalReservesPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-600">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Showing {(reservesPage - 1) * itemsPerPage + 1} - {Math.min(reservesPage * itemsPerPage, processedProjects.length)} of {processedProjects.length} reserves
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={reservesPage === 1}
                      onClick={() => setReservesPage(p => Math.max(p - 1, 1))}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] tracking-wider uppercase disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-[10px] text-slate-500">
                      Page {reservesPage} of {totalReservesPages}
                    </span>
                    <button
                      disabled={reservesPage === totalReservesPages}
                      onClick={() => setReservesPage(p => Math.min(p + 1, totalReservesPages))}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] tracking-wider uppercase disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Yearly Budgeting & Fiscal Books section */}
          {renderYearlyBudgetingAndFiscalBooks()}

          {/* 9. Budget Change History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">Budget Change History</h3>
                <p className="text-xs text-slate-500">Record of audit trails for budget limit adjustments and creations.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-6">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Performed By</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedBudgetLogs.map((log, idx) => (
                      <tr key={`budget-log-${log.id || idx}-${idx}`} className="hover:bg-slate-50/50">
                        <td className="py-3 px-6">{formatDate(log.timestamp)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{log.action === 'BUDGET_ADJUSTMENT' ? 'ADJUSTMENT' : log.action}</td>
                        <td className="py-3 px-4">{log.performedBy}</td>
                        <td className="py-3 px-4">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalBudgetHistoryPages > 1 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Showing {paginatedBudgetLogs.length} of {budgetLogs.length} logs
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      disabled={budgetHistoryPage === 1}
                      onClick={() => setBudgetHistoryPage(p => Math.max(p - 1, 1))}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] tracking-wider uppercase disabled:opacity-50 transition-colors cursor-pointer text-slate-600 font-bold"
                    >
                      Prev
                    </button>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Page {budgetHistoryPage} of {totalBudgetHistoryPages}
                    </span>
                    <button
                      disabled={budgetHistoryPage === totalBudgetHistoryPages}
                      onClick={() => setBudgetHistoryPage(p => Math.min(p + 1, totalBudgetHistoryPages))}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] tracking-wider uppercase disabled:opacity-50 transition-colors cursor-pointer text-slate-600 font-bold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
          </div>

        </div>
      )}

      {/* 8. MODAL: Manual Disbursement Settlement Form */}
      <AnimatePresence>
        {disbursingReq && (() => {
          const requesterObj = users?.find(u => u.id === disbursingReq.requesterId || u.name === disbursingReq.requesterName);
          const resolvedEmail = disbursingReq.requesterEmail || requesterObj?.email || `${disbursingReq.requesterName.toLowerCase().replace(/\s+/g, "")}@church.org`;
          const requesterRole = requesterObj?.role || "Church Group Representative";
          const historyList = Array.isArray(disbursingReq.approvalHistory) ? disbursingReq.approvalHistory : [];

          return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] max-w-2xl w-full overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="bg-slate-900 text-white p-5 sticky top-0 z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-400/30">
                      <Receipt className="text-indigo-400 animate-pulse" size={22} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">Disbursement & Settlement Voucher</h3>
                      <p className="text-[11px] text-slate-400">Review requester & approver authorization details before funds release.</p>
                    </div>
                  </div>
                  <button onClick={() => setDisbursingReq(null)} className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-white cursor-pointer">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleRecordPayout} className="p-5 md:p-6 space-y-5 flex-1 overflow-y-auto">
                  
                  {/* 1. Requisition Summary Card */}
                  <div className="border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        REQUISITION #{disbursingReq.id.substr(0, 8)}
                      </span>
                      <span className="text-indigo-900 bg-indigo-100/70 px-2.5 py-0.5 rounded-full font-semibold text-[10px]">
                        {disbursingReq.groupName}
                      </span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pt-1">
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{disbursingReq.title}</h4>
                      <div className="text-lg font-black text-indigo-700 shrink-0">
                        {formatCurrency(disbursingReq.amount)}
                      </div>
                    </div>

                    {disbursingReq.amountWords && (
                      <p className="text-[10px] font-medium text-slate-500 italic">
                        Amount in words: {disbursingReq.amountWords}
                      </p>
                    )}

                    {disbursingReq.description && (
                      <div className="text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-200/60 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Purpose / Description</span>
                        {disbursingReq.description}
                      </div>
                    )}

                    {disbursingReq.payableTo && (
                      <div className="flex items-center gap-2 text-xs text-slate-700 font-medium pt-0.5">
                        <CreditCard size={14} className="text-slate-400 shrink-0" />
                        <span>Payable To / Beneficiary: <strong className="text-slate-900">{disbursingReq.payableTo}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* 2. Requester Details */}
                  <div className="border border-slate-200 bg-white rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <User size={15} className="text-indigo-600" />
                        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Requester Information</h5>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        {requesterRole}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</span>
                        <p className="font-semibold text-slate-900">{disbursingReq.requesterName}</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Email</span>
                        <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{resolvedEmail}</span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ministry / Department</span>
                        <p className="font-medium text-slate-800">{disbursingReq.groupName}</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date Submitted</span>
                        <div className="flex items-center gap-1 text-slate-700">
                          <Clock size={12} className="text-slate-400 shrink-0" />
                          <span>{disbursingReq.submittedAt ? new Date(disbursingReq.submittedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Approvers & Authorization History */}
                  <div className="border border-slate-200 bg-white rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Approvers & Authorization Trail</h5>
                      </div>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <CheckCircle2 size={10} /> Fully Authorized
                      </span>
                    </div>

                    {/* Milestones (L1 & L2) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-lg flex items-start gap-2.5">
                        <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md shrink-0 mt-0.5">
                          <UserCheck size={14} />
                        </div>
                        <div className="space-y-0.5 text-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Level 1 (Group Leader / L1)</span>
                          <p className="font-semibold text-slate-900">
                            {historyList.find(h => h.role === UserRole.APPROVER_L1 || h.role === UserRole.CHURCH_GROUP)?.approverName || "Presbytery Official"}
                          </p>
                          <span className="text-[10px] text-slate-500 block">
                            {disbursingReq.approvedAtL1 ? new Date(disbursingReq.approvedAtL1).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : "Verified & Endorsed"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-lg flex items-start gap-2.5">
                        <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-md shrink-0 mt-0.5">
                          <ShieldCheck size={14} />
                        </div>
                        <div className="space-y-0.5 text-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Level 2 (Finance / L2)</span>
                          <p className="font-semibold text-slate-900">
                            {historyList.find(h => h.role === UserRole.APPROVER_L2 || h.role === UserRole.FINANCE || h.role === UserRole.ADMIN)?.approverName || "Finance Treasurer"}
                          </p>
                          <span className="text-[10px] text-slate-500 block">
                            {disbursingReq.approvedAtL2 ? new Date(disbursingReq.approvedAtL2).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : "Authorized for Payout"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Protocol Logs if available */}
                    {historyList.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Audit Protocol History</span>
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                          {historyList.map((h, i) => (
                            <div key={i} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className="text-slate-900">{h.approverName}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-semibold">{h.role}</span>
                                </div>
                                <span className="text-slate-400 font-mono">
                                  {new Date(h.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span className="font-medium">Method: <strong className="text-slate-700">{h.method || "VERIFIED"}</strong></span>
                                <span className={cn(
                                  "px-1.5 py-0.2 rounded font-bold uppercase",
                                  h.decision === "APPROVE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                )}>
                                  {h.decision}
                                </span>
                              </div>

                              {h.note && (
                                <p className="text-[11px] text-slate-600 italic bg-white p-1.5 rounded border border-slate-100 mt-1">
                                  "{h.note}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Disbursement Settlement Details (Form inputs) */}
                  <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-4">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Banknote size={15} className="text-indigo-600" />
                      Disbursement Payout Release Details
                    </h5>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Disbursement Channel</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: "MPESA", label: "M-PESA" },
                          { id: "EFT", label: "Bank EFT" },
                          { id: "CHEQUE", label: "Cheque" },
                          { id: "CASH", label: "Cash" }
                        ].map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => setDisburseMethod(ch.id as any)}
                            className={cn(
                              "py-2 px-3 text-center rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border",
                              disburseMethod === ch.id 
                                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Transaction / Ref Reference</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., MPESA-TXN-2831, CHQ #001223"
                        value={referenceNum}
                        onChange={(e) => setReferenceNum(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-mono shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Verification Comment (Optional)</label>
                      <textarea
                        rows={2}
                        placeholder="Provide clerical details, bank transfer receipt references..."
                        value={payoutNotes}
                        onChange={(e) => setPayoutNotes(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 sticky bottom-0 bg-white pb-1">
                    <button
                      type="button"
                      onClick={() => setDisbursingReq(null)}
                      className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCommitingPayout}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                    >
                      {isCommitingPayout ? (
                        <>Committing Payout...</>
                      ) : (
                        <>
                          <CheckCircle2 size={16} /> Confirm Release
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 9. MODAL: Budget Top Up Allocation Form */}
      <AnimatePresence>
        {adjustingProject && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-none md:rounded-2xl shadow-xl border-t md:border border-slate-200 h-full md:h-auto max-w-sm w-full overflow-hidden flex flex-col"
            >
              <div className="bg-[#4f46e5] text-white p-5 sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#e0e7ff]">Modify Budget Limits</h3>
                    <p className="text-[10px] text-indigo-100">Set overall allocations and requisition caps on ledger lines.</p>
                  </div>
                </div>
                <button onClick={() => setAdjustingProject(null)} className="p-2 hover:bg-indigo-700 rounded-full transition-all text-indigo-100 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleBudgetTopUp} className="p-5 space-y-4 flex-1 overflow-y-auto">
                
                <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">PROJECT</div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">{adjustingProject.name}</h4>
                  <p className="text-[10px] text-slate-500">Current Allocation: <span className="font-bold">{formatCurrency(adjustingProject.allocatedBudget)}</span></p>
                  <p className="text-[10px] text-slate-500">Requisition Limit: <span className="font-bold">{formatCurrency(adjustingProject.requisitionLimit || adjustingProject.allocatedBudget)}</span></p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 4010-B"
                    value={adjustingAccountNumber}
                    onChange={(e) => setAdjustingAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold"
                  />
                  {adjustingAccountNumber && !isDuplicateAccountNumberForEdit && (
                    <p className="text-[9.5px] text-emerald-700 font-bold ml-1">
                      ✅ Account Code is unique and available.
                    </p>
                  )}
                  {isDuplicateAccountNumberForEdit && (
                    <p className="text-rose-500 text-[9.5px] font-black uppercase tracking-wide ml-1">
                      ⚠️ Duplicate Account Code: Already assigned to another group!
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Overall Budget Limit (KES)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g., 500000"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold"
                  />
                  <span className="text-[9px] text-slate-400 block font-medium">Overwriting this updates the total budget available for the group.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Single Request Requisition Limit (KES)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g., 200000"
                    value={reqLimitAmount}
                    onChange={(e) => setReqLimitAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold"
                  />
                  <span className="text-[9px] text-slate-400 block font-medium">Updates the maximum value allowed with a single requisition request.</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdjustingProject(null)}
                    className="flex-1 py-2 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={topUpLoading || isDuplicateAccountNumberForEdit || !adjustingAccountNumber.trim()}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {topUpLoading ? "Updating..." : "Save Changes"}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 10. MODAL: Manage Fiscal Year Settings */}
      <AnimatePresence>
        {managingFy && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-none md:rounded-2xl shadow-xl border-t md:border border-slate-200 h-full md:h-auto max-w-sm w-full overflow-hidden flex flex-col text-slate-800"
            >
              <div className="bg-slate-900 text-white p-5 sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings size={18} />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">Manage FY {managingFy.year}</h3>
                    <p className="text-[10px] text-slate-400">Configure boundaries, labels, and planning notes</p>
                  </div>
                </div>
                <button onClick={() => setManagingFy(null)} className="p-2 hover:bg-slate-850 rounded-full transition-all text-slate-400 hover:text-white cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingEditFy(true);
                try {
                  await updateFiscalYearDates(
                    managingFy.year,
                    editFyStartDate || undefined,
                    editFyEndDate || undefined,
                    editFyLabel.trim(),
                    editFyNotes.trim()
                  );
                  alert(`Fiscal Year ${managingFy.year} updated successfully.`);
                  setManagingFy(null);
                } catch (err: any) {
                  alert(err.message || "Failed to update fiscal year settings.");
                } finally {
                  setIsSavingEditFy(false);
                }
              }} className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descriptor Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FY 2027 Outreach Plan"
                    value={editFyLabel}
                    onChange={(e) => setEditFyLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
                    <input
                      type="date"
                      value={editFyStartDate}
                      onChange={(e) => setEditFyStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End Date</label>
                    <input
                      type="date"
                      value={editFyEndDate}
                      onChange={(e) => setEditFyEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planning Notes / Objectives</label>
                  <textarea
                    rows={3}
                    placeholder="Provide description..."
                    value={editFyNotes}
                    onChange={(e) => setEditFyNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-2.5 pt-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setManagingFy(null)}
                      className="flex-1 py-2.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEditFy}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 shadow-md"
                    >
                      {isSavingEditFy ? "Saving..." : "Save Settings"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`⚠️ CRITICAL ACTION:\nAre you sure you want to permanently DELETE Fiscal Year ${managingFy.year}?\nThis will erase the definition block and cannot be undone.`)) {
                        try {
                          await deleteFiscalYear(managingFy.id);
                          alert(`Fiscal Year ${managingFy.year} has been permanently deleted.`);
                          setManagingFy(null);
                        } catch (err: any) {
                          alert(err.message || "Failed to delete fiscal year.");
                        }
                      }
                    }}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 size={11} />
                    Delete Fiscal Year
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
