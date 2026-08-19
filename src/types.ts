/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  CHURCH_GROUP = "CHURCH_GROUP",
  APPROVER_L1 = "APPROVER_L1",
  APPROVER_L2 = "APPROVER_L2",
  FINANCE = "FINANCE",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  summaryEmailFrequency?: "NONE" | "DAILY" | "WEEKLY";
  group?: string; // e.g., "Youth Ministry", "Womens Guild"
  groups?: string[]; // Multiple church group assignments
  approverCode?: string; // 6 digits for L1, 7 for L2
  isActive: boolean;
  isApproved: boolean;
  isSuspended: boolean;
  profilePromptPreference?: "ASK" | "NEVER";
  theme?: "light" | "dark";
  phone?: string;
  department?: string;
  photoURL?: string;
  tempPassword?: string;
  isOnline?: boolean;
  lastSeen?: string;
  forceLogout?: boolean;
  idleTimeoutDuration?: number; // Custom idle timeout duration in minutes (5, 15, 30)
  activeDevices?: DeviceSession[];
  lastSummaryEmailSentAt?: string;
}

export interface DeviceSession {
  id: string; // unique device ID
  userAgent: string;
  loginTime: string;
  lastActive: string;
}

export type SearchFilter = "ALL" | "TITLE" | "GROUP" | "REQUESTER";

export enum RequisitionStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED_L1 = "APPROVED_L1",
  APPROVED_L2 = "APPROVED_L2", // Same as APPROVED in some contexts
  ESCALATED = "ESCALATED",
  PARTIALLY_DISBURSED = "PARTIALLY_DISBURSED",
  DISBURSED = "DISBURSED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  DELETED = "DELETED",
}

export interface RequisitionInstallment {
  id: string;
  installmentNumber: number;
  title?: string;
  amount: number;
  percentage?: number;
  dueDate?: string;
  description?: string;
  status: "PENDING" | "DISBURSED" | "CANCELLED";
  disbursedAt?: string;
  disbursedBy?: string;
  disbursedByName?: string;
  disbursementReference?: string;
  paymentMethod?: "CHEQUE" | "CASH" | "MPESA" | "BANK_TRANSFER" | "EFT";
  disbursementMethod?: string;
  notes?: string;
}

export enum RecurrenceType {
  NONE = "NONE",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
}

export interface ApprovalNote {
  id: string;
  approverId: string;
  approverName: string;
  role: UserRole;
  note: string;
  decision: "APPROVE" | "REJECT" | "ESCALATE";
  rejectionReason?: string;
  approvalCode?: string; // Masked in UI
  method: "CODE" | "FINGERPRINT" | "SIGNATURE";
  timestamp: string;
}

export interface CommentReaction {
  emoji: string;
  userIds?: string[];
  userId?: string;
  userEmail?: string;
  userName?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorRole?: string;
  authorAvatar?: string;
  authorPhotoURL?: string; // backwards compatibility
  text: string;
  timestamp?: string;      // backwards compatibility
  createdAt?: string;      // ISO timestamp
  parentId?: string | null;// For nested replies
  replyTo?: {
    id: string;
    authorName: string;
    text: string;
  };
  reactions?: CommentReaction[] | Record<string, any>;
  reactionCounts?: Record<string, number>;
  reactedUserIds?: string[];
  reactionSummary?: {
    counts: Record<string, number>;
    userIds: string[];
    total: number;
  };
  replies?: Comment[];
  isEdited?: boolean;
  attachments?: any[];
}

export type RequisitionComment = Comment;

export interface Requisition {
  id: string;
  projectId?: string; // Linked project
  title: string;
  description: string;
  amount: number;
  amountWords?: string;
  groupId: string;
  groupName: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  status: RequisitionStatus;
  submittedAt: string;
  updatedAt: string;
  expiresAt?: string;
  escalationLevel?: number;
  escalationNotificationsSent?: boolean;
  approvedAtL1?: string;
  approvedAtL2?: string;
  disbursedAt?: string;
  rejectionReason?: string;
  approvalHistory: ApprovalNote[];
  comments?: Comment[];
  digitalSignature?: string; // base64
  payableTo?: string; // Vendor name
  recurrence?: RecurrenceType;
  lastRecurrenceGeneratedAt?: string;
  additionalInfo?: string;
  attachments?: string[];
  receipts?: string[];
  notificationEmails?: string[];
  isSharedRequisition?: boolean;
  sharedGroups?: string[];
  enableInstallments?: boolean;
  installments?: RequisitionInstallment[];
  disbursedAmount?: number;
  remainingBalance?: number;
  flaggedForAudit?: boolean;
  inProcurement?: boolean;
  requiresMoreInfo?: boolean;
  fiscalYear?: number;
  createdBy?: string;
  createdAt?: string;
}

export interface FiscalYear {
  id: string;
  year: number;
  label: string;
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  createdAt: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface Budget {
  id: string;
  groupId: string;
  allocated: number;
  spent: number;
  lastUpdated: string;
}

export interface BiometricSettings {
  id: string;
  userId: string;
  isEnrolled: boolean;
  requireForApproval: boolean;
  lastEnrollment?: string;
  credentialId?: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  theme: "LIGHT" | "DARK";
}

export interface Project {
  id: string;
  name: string;
  groupId: string;
  allocatedBudget: number;
  spentAmount: number;
  committedAmount?: number;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CLOSED";
  color?: string;
  fiscalYear?: number;
  requisitionLimit?: number;
  accountNumber?: string;
}

export interface ForecastMonth {
  month: string;
  projected: number;
  actual: number;
}

export interface BudgetAlert {
  id: string;
  type: "OVERSHOOT" | "LARGE_REQUEST" | "EXPIRY" | "L2_APPROVED" | "FINANCE_DISBURSEMENT" | "SYSTEM_INFO" | "SECURITY_UPDATE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  timestamp: string;
  isRead: boolean;
  targetRole?: string;
  targetUserId?: string;
}

export interface AlertThreshold {
  id: string;
  type: string;
  threshold: number;
  isEnabled: boolean;
  notifyEmail: boolean;
}

export interface ChurchGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface LedgerBook {
  id: string;
  ministryId?: string;
  ministryName: string;
  bookName?: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  creatorName?: string;
  budgetLimit: number;
  spentAmount: number;
  notes?: string;
  status: "ACTIVE" | "CLOSED";
}

export interface SystemLog {
  id: string;
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
  groupId?: string;
  metadata?: any;
}

export interface EmailAuditLog {
  id: string;
  timestamp: string;
  action: string;
  category: "REQUISITION_WORKFLOW" | "BACKUP_SNAPSHOT" | "PASSWORD_RESET" | "BULK_ANNOUNCEMENT" | "SYSTEM_ALERT" | "DIGEST_SUMMARY" | "OTHER";
  recipientEmail: string;
  recipientName?: string;
  ccList?: string[];
  subject: string;
  requisitionId?: string;
  requisitionTitle?: string;
  amount?: number;
  status: "DELIVERED" | "SIMULATED" | "SKIPPED" | "FAILED" | "PENDING";
  performedBy: string;
  details: string;
  metadata?: any;
  sizeKb?: number;
  fileName?: string;
}

export interface SavedReport {
  id: string;
  title: string;
  description: string;
  generatedBy: string;
  generatedById: string;
  timestamp: string;
  period: string;
  stats: {
    grossValue: number;
    disbursed: number;
    approved: number;
    pending: number;
  };
  filters: {
    startDate?: string;
    endDate?: string;
    group?: string;
    status?: string;
  };
  itemCount: number;
}

export enum TransactionType {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT",
  TRANSFER = "TRANSFER",
  ADJUSTMENT = "ADJUSTMENT",
}

export enum TransactionStatus {
  COMPLETED = "COMPLETED",
  PENDING = "PENDING",
  FAILED = "FAILED",
  FLAGGED = "FLAGGED",
}

export interface Transaction {
  id: string;
  externalRef: string;
  sourceSystem: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  description: string;
  category: string;
  timestamp: string;
  performedBy: string;
  metadata?: any;
}

export interface PermissionConfig {
  id: string;
  role: UserRole;
  access: {
    dashboard: boolean;
    requisitions: boolean;
    approvals: boolean;
    finance: boolean;
    reports: boolean;
    users: boolean;
    settings: boolean;
    accessControl: boolean;
    auditTrail: boolean;
    transactions: boolean;
    vendors?: boolean;
    notifications?: boolean;
  };
  actions: {
    canCreateRequisition: boolean;
    canApproveL1: boolean;
    canApproveL2: boolean;
    canDisburse: boolean;
    canDeleteRequisition: boolean;
    canManageUsers: boolean;
    canManageSettings: boolean;
    canViewTransactions: boolean;
    canExportReports?: boolean;
    canManageBudgets?: boolean;
  };
}

export interface SystemSettings {
  prototypeDataEnabled?: boolean;
  hideSupplementaryBudgetBtn?: boolean;
  vendorListViewLevel?: "ALL_USERS" | "APPROVERS_UP" | "FINANCE_UP" | "ADMINS_ONLY";
  isSystemOffline?: boolean;
  currentFiscalYear?: number;
  fiscalYearStatus?: "OPEN" | "CLOSED" | "ARCHIVED";
  fiscalYearStartDate?: string;
  fiscalYearEndDate?: string;
  notificationEmail?: string;
  centralVaultLiquidity?: number;
  announcementMessage?: string;
  announcementType?: "info" | "warning" | "alert" | "success";
  announcementIsActive?: boolean;
  requisitionExpiryDays?: number;
}

export interface SupplementaryBudgetRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  role: string;
  projectId: string;
  projectName: string;
  amount: number;
  justification: string;
  submittedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export type VendorStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface Vendor {
  id: string;
  name: string;
  contact?: string;
  location?: string;
  offerings?: string;
  createdAt: string;
  addedBy: string;
  status?: VendorStatus;
}

export const VENDOR_SERVICE_CATEGORIES = [
  "Stationery & Office Supplies",
  "Catering & Food Services",
  "Event Planning & Management",
  "Tent & Furniture Hire",
  "Sound & PA Systems",
  "Audio-Visual & Multimedia",
  "Cleaning, Sanitation & Laundry",
  "Security Services & CCTV",
  "Building Maintenance & Structural Repairs",
  "Electrical & Power Backup",
  "Plumbing & Drainage",
  "IT Hardware & Networking",
  "Software & Web Development",
  "Printing & Publishing",
  "Photocopying & Documentation",
  "Branding & Signage",
  "Uniforms & Liturgical Vestments",
  "Transportation & Car Hire",
  "Medical Supplies & First Aid",
  "Musical Instruments & Support",
  "Landscaping & Florists",
  "Construction & Carpentry",
  "Hardware, Tools & Paint",
  "Waste Disposal & Recycling",
  "Legal & Notary Services",
  "Audit & Accounting",
  "Insurance Services",
  "Fuel & Gas Supplies",
  "Interior Design & Upholstery",
  "Water Supply & Borehole Maint",
  "Pest Control & Fumigation",
  "Photography & Videography",
  "Live Streaming & Broadcasting",
  "Travel & Hotel Bookings",
  "Advertising & PR",
  "Human Resource & Training",
  "Courier & Delivery Services",
  "Property Management",
  "Architects & Surveyors",
  "Decoration & Event Setup",
  "Bibles & Educational Materials",
  "Agricultural Supplies",
  "Mechanical & Garage Services",
  "Fire Safety & Equipment",
  "HVAC & Air Conditioning",
  "Solar Energy Solutions",
  "Digital Marketing",
  "Counseling Services",
  "Funeral & Bereavement Support",
  "Welfare & Social Services"
];

export interface CustomCalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD format e.g. "2026-07-28"
  time?: string;
  category: "MEETING" | "DEADLINE" | "AUDIT" | "EVENT" | "MAINTENANCE" | "OTHER";
  badge: string;
  createdBy: string;
  createdAt: string;
}

export interface BackgroundUploadTask {
  id: string;
  requisitionId?: string;
  title: string;
  totalFiles: number;
  completedFiles: number;
  currentFileName: string;
  progressPercent: number;
  status: "QUEUED" | "UPLOADING" | "COMPLETED" | "FAILED";
  error?: string;
  startedAt: string;
}



