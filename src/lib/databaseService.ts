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
      status: project.status,
      color: project.color || null,
      fiscal_year: project.fiscalYear || null,
      requisition_limit: project.requisitionLimit || null,
      account_number: project.accountNumber || null
    });
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
      flagged_for_audit: req.flaggedForAudit || false,
      in_procurement: req.inProcurement || false,
      requires_more_info: req.requiresMoreInfo || false,
      fiscal_year: req.fiscalYear || null,
      comments: req.comments || []
    });
  },

  async deleteRequisition(id: string): Promise<void> {
    console.log(`[DatabaseService] Deleting requisition from MongoDB: ${id}`);
    await apiCall(`/api/db/requisitions/${id}`, "DELETE");
  },

  async updateProject(id: string, data: any): Promise<void> {
    console.log(`[DatabaseService] Updating project in MongoDB: ${id}`);
    await apiCall(`/api/db/projects/${id}`, "PATCH", data);
  },

  // --- SYSTEM LOGS OPERATIONS ---
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

  async migrateFirestoreToSupabase(setProgress?: any): Promise<{success: boolean, error?: string}> {
    return { success: false, error: "Migration removed." };
  }
};
