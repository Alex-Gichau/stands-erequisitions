import { 
  Requisition, 
  Project, 
  UserProfile, 
  SystemLog,
  BudgetAlert,
  FiscalYear,
  Transaction,
  ForecastMonth,
  SavedReport,
  PermissionConfig,
  AlertThreshold,
  ChurchGroup,
  LedgerBook,
  SupplementaryBudgetRequest,
  Vendor 
} from "../types";
import { getAuth } from "firebase/auth";

// Helper for making API calls
async function apiCall(endpoint: string, method: string = "GET", body?: any): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const auth = getAuth();
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (e) {
    // Suppress if Firebase is not yet initialized or auth is unavailable
  }

  const options: RequestInit = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(endpoint, options);
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 429) {
      console.warn(`[DB API Rate Exceeded 429] ${method} ${endpoint}`);
      throw new Error(`DB API Rate Exceeded (429)`);
    }
    throw new Error(`DB API Error ${response.status}: ${text || response.statusText}`);
  }
  return response.json();
}

export const databaseService = {
  // --- USER OPERATIONS ---
  async saveUserProfile(user: UserProfile): Promise<void> {
    console.log(`[DatabaseService] Saving user profile to MongoDB: ${user.email}`);
    await apiCall(`/api/db/users/${user.id}`, "POST", {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      group: user.group || null,
      groups: user.groups || [],
      approver_code: user.approverCode || null,
      is_active: user.isActive,
      is_approved: user.isApproved,
      is_suspended: user.isSuspended,
      phone: user.phone || null,
      department: user.department || null,
      photo_url: user.photoURL || null,
      temp_password: user.tempPassword || null,
      is_online: user.isOnline || false,
      last_seen: user.lastSeen ? new Date(user.lastSeen).toISOString() : null,
      idle_timeout_duration: user.idleTimeoutDuration || 15,
      updated_at: new Date().toISOString()
    });
  },

  // --- PROJECT OPERATIONS ---
  async saveProject(project: Project): Promise<void> {
    console.log(`[DatabaseService] Saving project to MongoDB: ${project.name}`);
    await apiCall(`/api/db/projects/${project.id}`, "POST", {
      id: project.id,
      name: project.name,
      group_id: project.groupId,
      allocated_budget: project.allocatedBudget,
      spent_amount: project.spentAmount,
      committed_amount: project.committedAmount || 0,
      status: project.status,
      color: project.color || null,
      fiscal_year: project.fiscalYear || null,
      requisition_limit: project.requisitionLimit || null,
      account_number: project.accountNumber || null
    });
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    console.log(`[DatabaseService] Updating project in MongoDB: ${id}`);
    const mapped: any = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.groupId !== undefined) mapped.group_id = updates.groupId;
    if (updates.allocatedBudget !== undefined) mapped.allocated_budget = updates.allocatedBudget;
    if (updates.spentAmount !== undefined) mapped.spent_amount = updates.spentAmount;
    if (updates.committedAmount !== undefined) mapped.committed_amount = updates.committedAmount;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.color !== undefined) mapped.color = updates.color;
    if (updates.fiscalYear !== undefined) mapped.fiscal_year = updates.fiscalYear;
    if (updates.requisitionLimit !== undefined) mapped.requisition_limit = updates.requisitionLimit;
    if (updates.accountNumber !== undefined) mapped.account_number = updates.accountNumber;
    mapped.updated_at = new Date().toISOString();
    await apiCall(`/api/db/projects/${id}`, "PATCH", mapped);
  },

  async deleteProject(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting project from MongoDB: ${id}`);
    await apiCall(`/api/db/projects/${id}`, "DELETE");
  },

  async saveChurchGroup(group: ChurchGroup): Promise<void> {
    console.log(`[DatabaseService] Saving church group to MongoDB: ${group.name}`);
    await apiCall(`/api/db/church_groups/${group.id}`, "POST", {
      id: group.id,
      name: group.name,
      description: group.description || null,
      created_at: group.createdAt ? new Date(group.createdAt).toISOString() : new Date().toISOString()
    });
  },

  async deleteChurchGroup(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting church group from MongoDB: ${id}`);
    await apiCall(`/api/db/church_groups/${id}`, "DELETE");
  },

  async saveLedgerBook(book: LedgerBook): Promise<void> {
    console.log(`[DatabaseService] Saving ledger book to MongoDB: ${book.ministryName}`);
    await apiCall(`/api/db/ledger_books/${book.id}`, "POST", {
      id: book.id,
      ministry_id: book.ministryId || null,
      ministry_name: book.ministryName,
      book_name: book.bookName || null,
      description: book.description || null,
      created_at: book.createdAt ? new Date(book.createdAt).toISOString() : new Date().toISOString(),
      created_by: book.createdBy,
      creator_name: book.creatorName || null,
      budget_limit: book.budgetLimit,
      spent_amount: book.spentAmount,
      notes: book.notes || null,
      status: book.status || "ACTIVE"
    });
  },

  async updateLedgerBook(id: string, data: Partial<LedgerBook>): Promise<void> {
    console.log(`[DatabaseService] Updating ledger book in MongoDB: ${id}`);
    const mappedData: any = {};
    if (data.ministryId !== undefined) mappedData.ministry_id = data.ministryId;
    if (data.ministryName !== undefined) mappedData.ministry_name = data.ministryName;
    if (data.bookName !== undefined) mappedData.book_name = data.bookName;
    if (data.budgetLimit !== undefined) mappedData.budget_limit = data.budgetLimit;
    if (data.spentAmount !== undefined) mappedData.spent_amount = data.spentAmount;
    if (data.status !== undefined) mappedData.status = data.status;
    if (data.notes !== undefined) mappedData.notes = data.notes;

    await apiCall(`/api/db/ledger_books/${id}`, "PATCH", mappedData);
  },

  // --- REQUISITION OPERATIONS ---
  async saveRequisition(req: Requisition): Promise<void> {
    console.log(`[DatabaseService] Saving requisition to MongoDB: ${req.title}`);
    await apiCall(`/api/db/requisitions/${req.id}`, "POST", {
      id: req.id,
      project_id: req.projectId || null,
      title: req.title,
      description: req.description,
      amount: req.amount,
      amount_words: req.amountWords || null,
      group_id: req.groupId,
      group_name: req.groupName,
      requester_id: req.requesterId,
      requester_name: req.requesterName,
      requester_email: req.requesterEmail || null,
      status: req.status,
      submitted_at: req.submittedAt ? new Date(req.submittedAt).toISOString() : null,
      updated_at: new Date(req.updatedAt || Date.now()).toISOString(),
      expires_at: req.expiresAt ? new Date(req.expiresAt).toISOString() : null,
      escalation_level: req.escalationLevel || 0,
      escalation_notifications_sent: req.escalationNotificationsSent || false,
      approved_at_l1: req.approvedAtL1 ? new Date(req.approvedAtL1).toISOString() : null,
      approved_at_l2: req.approvedAtL2 ? new Date(req.approvedAtL2).toISOString() : null,
      disbursed_at: req.disbursedAt ? new Date(req.disbursedAt).toISOString() : null,
      rejection_reason: req.rejectionReason || null,
      approval_history: req.approvalHistory || [],
      digital_signature: req.digitalSignature || null,
      payable_to: req.payableTo || null,
      recurrence: req.recurrence || "NONE",
      last_recurrence_generated_at: req.lastRecurrenceGeneratedAt ? new Date(req.lastRecurrenceGeneratedAt).toISOString() : null,
      additional_info: req.additionalInfo || null,
      attachments: req.attachments || [],
      receipts: req.receipts || [],
      notification_emails: Array.isArray(req.notificationEmails) ? req.notificationEmails : (typeof req.notificationEmails === 'object' && req.notificationEmails ? Object.values(req.notificationEmails) : []),
      notificationEmails: Array.isArray(req.notificationEmails) ? req.notificationEmails : (typeof req.notificationEmails === 'object' && req.notificationEmails ? Object.values(req.notificationEmails) : []),
      is_shared_requisition: req.isSharedRequisition || false,
      shared_groups: req.sharedGroups || [],
      enable_installments: req.enableInstallments || false,
      enableInstallments: req.enableInstallments || false,
      installments: Array.isArray(req.installments) ? req.installments : [],
      disbursed_amount: req.disbursedAmount !== undefined ? req.disbursedAmount : 0,
      disbursedAmount: req.disbursedAmount !== undefined ? req.disbursedAmount : 0,
      remaining_balance: req.remainingBalance !== undefined ? req.remainingBalance : (req.amount || 0),
      remainingBalance: req.remainingBalance !== undefined ? req.remainingBalance : (req.amount || 0),
      flagged_for_audit: req.flaggedForAudit || false,
      in_procurement: req.inProcurement || false,
      requires_more_info: req.requiresMoreInfo || false,
      fiscal_year: req.fiscalYear || null,
      comments: req.comments || []
    });
  },

  async patchRequisition(id: string, updates: Partial<Requisition>): Promise<void> {
    const payload: any = {};
    if (updates.comments !== undefined) payload.comments = updates.comments;
    if (updates.notificationEmails !== undefined) {
      payload.notification_emails = updates.notificationEmails;
      payload.notificationEmails = updates.notificationEmails;
    }
    if (updates.requiresMoreInfo !== undefined) payload.requires_more_info = updates.requiresMoreInfo;
    if (updates.flaggedForAudit !== undefined) payload.flagged_for_audit = updates.flaggedForAudit;
    if (updates.additionalInfo !== undefined) payload.additional_info = updates.additionalInfo;
    if (updates.enableInstallments !== undefined) {
      payload.enable_installments = updates.enableInstallments;
      payload.enableInstallments = updates.enableInstallments;
    }
    if (updates.installments !== undefined) {
      payload.installments = updates.installments;
    }
    if (updates.disbursedAmount !== undefined) {
      payload.disbursed_amount = updates.disbursedAmount;
      payload.disbursedAmount = updates.disbursedAmount;
    }
    if (updates.remainingBalance !== undefined) {
      payload.remaining_balance = updates.remainingBalance;
      payload.remainingBalance = updates.remainingBalance;
    }
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.amountWords !== undefined) payload.amount_words = updates.amountWords;
    if (updates.payableTo !== undefined) payload.payable_to = updates.payableTo;
    if (updates.groupName !== undefined) {
      payload.group_name = updates.groupName;
      payload.groupName = updates.groupName;
    }
    if (updates.groupId !== undefined) {
      payload.group_id = updates.groupId;
      payload.groupId = updates.groupId;
    }
    if (updates.attachments !== undefined) payload.attachments = updates.attachments;
    if (updates.receipts !== undefined) payload.receipts = updates.receipts;
    if (updates.status !== undefined) payload.status = updates.status;
    payload.updated_at = new Date().toISOString();
    await apiCall(`/api/db/requisitions/${id}`, "PATCH", payload);
  },

  async deleteRequisition(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting requisition from MongoDB: ${id}`);
    await apiCall(`/api/db/requisitions/${id}`, "DELETE");
  },

  // --- FISCAL YEAR OPERATIONS ---
  async saveFiscalYear(fy: FiscalYear): Promise<void> {
    console.log(`[DatabaseService] Saving fiscal year to MongoDB: ${fy.year}`);
    await apiCall(`/api/db/fiscal_years/${fy.id || fy.year}`, "POST", {
      id: String(fy.id || fy.year),
      year: fy.year,
      label: fy.label,
      start_date: fy.startDate ? new Date(fy.startDate).toISOString() : null,
      end_date: fy.endDate ? new Date(fy.endDate).toISOString() : null,
      status: fy.status,
      notes: fy.notes || null,
      created_at: fy.createdAt ? new Date(fy.createdAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  },

  async updateFiscalYear(id: string, updates: Partial<FiscalYear>): Promise<void> {
    console.log(`[DatabaseService] Updating fiscal year in MongoDB: ${id}`);
    const mapped: any = {};
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.label !== undefined) mapped.label = updates.label;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    if (updates.startDate !== undefined) mapped.start_date = updates.startDate ? new Date(updates.startDate).toISOString() : null;
    if (updates.endDate !== undefined) mapped.end_date = updates.endDate ? new Date(updates.endDate).toISOString() : null;
    mapped.updated_at = new Date().toISOString();
    await apiCall(`/api/db/fiscal_years/${id}`, "PATCH", mapped);
  },

  async deleteFiscalYear(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting fiscal year from MongoDB: ${id}`);
    await apiCall(`/api/db/fiscal_years/${id}`, "DELETE");
  },

  // --- VENDOR OPERATIONS ---
  async saveVendor(vendor: Vendor): Promise<void> {
    console.log(`[DatabaseService] Saving vendor to MongoDB: ${vendor.name}`);
    await apiCall(`/api/db/vendors/${vendor.id}`, "POST", {
      id: vendor.id,
      name: vendor.name,
      contact: vendor.contact || null,
      location: vendor.location || null,
      offerings: vendor.offerings || null,
      status: vendor.status || "APPROVED",
      added_by: vendor.addedBy || "Admin",
      created_at: vendor.createdAt ? new Date(vendor.createdAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  },

  async updateRequisition(id: string, updates: Partial<Requisition>): Promise<void> {
    return this.patchRequisition(id, updates);
  },

  async updateVendor(id: string, updates: Partial<Vendor>): Promise<void> {
    console.log(`[DatabaseService] Updating vendor in MongoDB: ${id}`);
    const mapped: any = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.contact !== undefined) mapped.contact = updates.contact;
    if (updates.location !== undefined) mapped.location = updates.location;
    if (updates.offerings !== undefined) mapped.offerings = updates.offerings;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.addedBy !== undefined) mapped.added_by = updates.addedBy;
    mapped.updated_at = new Date().toISOString();
    await apiCall(`/api/db/vendors/${id}`, "PATCH", mapped);
  },

  async deleteVendor(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting vendor from MongoDB: ${id}`);
    await apiCall(`/api/db/vendors/${id}`, "DELETE");
  },

  // --- SUPPLEMENTARY BUDGET OPERATIONS ---
  async saveSupplementaryBudget(sb: SupplementaryBudgetRequest): Promise<void> {
    console.log(`[DatabaseService] Saving supplementary budget to MongoDB: ${sb.id}`);
    await apiCall(`/api/db/supplementary_budgets/${sb.id}`, "POST", {
      id: sb.id,
      project_id: sb.projectId,
      project_name: sb.projectName,
      amount: sb.amount,
      justification: sb.justification,
      status: sb.status,
      requester_id: sb.requesterId,
      requester_name: sb.requesterName,
      requester_email: sb.requesterEmail,
      role: sb.role,
      submitted_at: sb.submittedAt ? new Date(sb.submittedAt).toISOString() : new Date().toISOString()
    });
  },

  // --- ALERT OPERATIONS ---
  async saveAlert(alert: BudgetAlert): Promise<void> {
    console.log(`[DatabaseService] Saving budget alert to MongoDB: ${alert.id}`);
    await apiCall(`/api/db/alerts/${alert.id}`, "POST", {
      id: alert.id,
      message: alert.message,
      type: alert.type,
      severity: alert.severity,
      timestamp: alert.timestamp ? new Date(alert.timestamp).toISOString() : new Date().toISOString(),
      is_read: alert.isRead || false,
      isRead: alert.isRead || false,
      target_role: alert.targetRole || null,
      targetRole: alert.targetRole || null,
      target_user_id: alert.targetUserId || null,
      targetUserId: alert.targetUserId || null
    });
  },

  async updateAlert(id: string, updates: Partial<BudgetAlert>): Promise<void> {
    const mapped: any = {};
    if (updates.isRead !== undefined) {
      mapped.is_read = updates.isRead;
      mapped.isRead = updates.isRead;
    }
    if (updates.message !== undefined) mapped.message = updates.message;
    await apiCall(`/api/db/alerts/${id}`, "PATCH", mapped);
  },

  async deleteAlert(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting alert from MongoDB: ${id}`);
    await apiCall(`/api/db/alerts/${id}`, "DELETE");
  },

  // --- THRESHOLD OPERATIONS ---
  async updateThreshold(id: string, updates: Partial<AlertThreshold>): Promise<void> {
    console.log(`[DatabaseService] Updating alert threshold in MongoDB: ${id}`);
    const mapped: any = {};
    if (updates.threshold !== undefined) mapped.threshold = updates.threshold;
    if (updates.isEnabled !== undefined) {
      mapped.is_enabled = updates.isEnabled;
      mapped.isEnabled = updates.isEnabled;
    }
    if (updates.notifyEmail !== undefined) {
      mapped.notify_email = updates.notifyEmail;
      mapped.notifyEmail = updates.notifyEmail;
    }
    if (updates.type !== undefined) mapped.type = updates.type;
    await apiCall(`/api/db/thresholds/${id}`, "PATCH", mapped);
  },

  // --- REPORT OPERATIONS ---
  async saveReport(report: SavedReport): Promise<void> {
    console.log(`[DatabaseService] Saving report to MongoDB: ${report.title}`);
    await apiCall(`/api/db/reports/${report.id}`, "POST", {
      id: report.id,
      title: report.title,
      description: report.description || null,
      period: report.period,
      stats: report.stats || {},
      filters: report.filters || {},
      item_count: report.itemCount,
      itemCount: report.itemCount,
      generated_by: report.generatedBy,
      generatedBy: report.generatedBy,
      generated_by_id: report.generatedById,
      generatedById: report.generatedById,
      timestamp: report.timestamp ? new Date(report.timestamp).toISOString() : new Date().toISOString()
    });
  },

  // --- SETTINGS & PERMISSION OPERATIONS ---
  async saveSettings(settings: any): Promise<void> {
    console.log(`[DatabaseService] Saving settings to MongoDB`);
    await apiCall(`/api/db/settings/system`, "POST", {
      id: "system",
      ...settings,
      updated_at: new Date().toISOString()
    });
  },

  async savePermission(roleId: string, permissions: any): Promise<void> {
    console.log(`[DatabaseService] Saving permissions to MongoDB for role: ${roleId}`);
    await apiCall(`/api/db/permissions/${roleId}`, "POST", {
      id: roleId,
      ...permissions,
      updated_at: new Date().toISOString()
    });
  },

  // --- TRANSACTION OPERATIONS ---
  async saveTransaction(tx: Transaction): Promise<void> {
    console.log(`[DatabaseService] Saving transaction to MongoDB: ${tx.id}`);
    await apiCall(`/api/db/transactions/${tx.id}`, "POST", {
      id: tx.id,
      external_ref: tx.externalRef,
      externalRef: tx.externalRef,
      source_system: tx.sourceSystem,
      sourceSystem: tx.sourceSystem,
      amount: tx.amount,
      type: tx.type,
      status: tx.status,
      description: tx.description || null,
      category: tx.category || null,
      performed_by: tx.performedBy || null,
      performedBy: tx.performedBy || null,
      metadata: tx.metadata || {},
      timestamp: tx.timestamp ? new Date(tx.timestamp).toISOString() : new Date().toISOString()
    });
  },

  async deleteTransaction(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting transaction from MongoDB: ${id}`);
    await apiCall(`/api/db/transactions/${id}`, "DELETE");
  },

  // --- USER OPERATIONS ---
  async saveUser(user: Partial<UserProfile> & { id: string }): Promise<void> {
    console.log(`[DatabaseService] Saving user to MongoDB: ${user.email || user.id}`);
    await apiCall(`/api/db/users/${user.id}`, "POST", {
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      role: user.role || "CHURCH_GROUP",
      group: user.group || null,
      groups: user.groups || [],
      temp_password: user.tempPassword || null,
      tempPassword: user.tempPassword || null,
      approver_code: user.approverCode || null,
      approverCode: user.approverCode || null,
      is_active: user.isActive !== undefined ? user.isActive : true,
      isActive: user.isActive !== undefined ? user.isActive : true,
      is_approved: user.isApproved !== undefined ? user.isApproved : true,
      isApproved: user.isApproved !== undefined ? user.isApproved : true,
      is_suspended: user.isSuspended !== undefined ? user.isSuspended : false,
      isSuspended: user.isSuspended !== undefined ? user.isSuspended : false,
      updated_at: new Date().toISOString()
    });
  },

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<void> {
    console.log(`[DatabaseService] Updating user in MongoDB: ${id}`);
    const mapped: any = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.email !== undefined) mapped.email = updates.email;
    if (updates.role !== undefined) mapped.role = updates.role;
    if (updates.group !== undefined) mapped.group = updates.group;
    if (updates.groups !== undefined) mapped.groups = updates.groups;
    if (updates.approverCode !== undefined) mapped.approver_code = updates.approverCode;
    if (updates.isActive !== undefined) mapped.is_active = updates.isActive;
    if (updates.isApproved !== undefined) mapped.is_approved = updates.isApproved;
    if (updates.isSuspended !== undefined) mapped.is_suspended = updates.isSuspended;
    if (updates.forceLogout !== undefined) mapped.force_logout = updates.forceLogout;
    mapped.updated_at = new Date().toISOString();
    await apiCall(`/api/db/users/${id}`, "PATCH", mapped);
  },

  // --- DELETE USER ---
  async deleteUser(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting user from MongoDB: ${id}`);
    await apiCall(`/api/db/users/${id}`, "DELETE");
  },

  // --- SYSTEM LOGS OPERATIONS ---
  async getAuditLogs(): Promise<SystemLog[]> {
    console.log(`[DatabaseService] Fetching live audit logs from server (cache-exempt)`);
    const raw = await apiCall(`/api/db/audit_logs?_t=${Date.now()}`, "GET");
    if (!Array.isArray(raw)) return [];
    return raw.map((l: any) => ({
      id: l?.id?.toString() || `log-${Math.random()}`,
      action: l?.action || "",
      details: l?.details || "",
      performedBy: l?.performed_by || l?.performedBy || "",
      timestamp: l?.timestamp || "",
      groupId: l?.group_id || l?.groupId || "",
      metadata: l?.metadata || null
    })).filter(Boolean) as SystemLog[];
  },

  async saveAuditLog(log: SystemLog): Promise<void> {
    console.log(`[DatabaseService] Saving audit log to MongoDB`);
    const id = log.id || (log as any)._id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    await apiCall(`/api/db/audit_logs/${id}`, "POST", {
      id,
      action: log.action,
      details: log.details,
      performed_by: log.performedBy,
      timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString(),
      group_id: log.groupId || null,
      metadata: log.metadata || null
    });
  },

  async clearAllPrototypeData(): Promise<{success: boolean, error?: string}> {
    console.log("[DatabaseService] clearAllPrototypeData not implemented yet");
    return { success: true };
  },

  async saveReactionHistory(history: {
    id: string;
    requisitionId: string;
    commentId: string;
    userId: string;
    userName: string;
    userEmail: string;
    emoji: string;
    action: string;
    timestamp?: string;
    previousEmoji?: string | null;
  }): Promise<void> {
    console.log(`[DatabaseService] Persisting reaction history record to MongoDB: ${history.id} (${history.action} ${history.emoji})`);
    await apiCall(`/api/db/user_reaction_histories/${history.id}`, "POST", {
      id: history.id,
      requisition_id: history.requisitionId,
      comment_id: history.commentId,
      user_id: history.userId,
      user_name: history.userName,
      user_email: history.userEmail,
      emoji: history.emoji,
      action: history.action,
      timestamp: history.timestamp || new Date().toISOString(),
      previous_emoji: history.previousEmoji || null
    });
  },

  async migrateFirestoreToSupabase(setProgress?: any): Promise<{success: boolean, error?: string}> {
    return { success: false, error: "Migration removed." };
  }
};
