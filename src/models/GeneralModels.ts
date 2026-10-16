import mongoose, { Schema, Document } from 'mongoose';

// 1. AuditLog
/** AuditLog interface definition */
export interface IAuditLog extends Document {
  id?: string;
  action: string;
  details: string;
  performedBy: string;
  timestamp: Date;
  groupId?: string;
  metadata?: any;
}
/** AuditLog Schema definition for MongoDB */
const AuditLogSchema = new Schema<IAuditLog>({
  id: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  details: { type: String, required: true },
  performedBy: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  groupId: { type: String },
  metadata: { type: Schema.Types.Mixed },
}, { strict: false });
export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema, 'system_logs');

// 2. Alert
/** Alert interface definition */
export interface IAlert extends Document {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  targetRole?: string;
}
/** Alert Schema definition for MongoDB */
const AlertSchema = new Schema<IAlert>({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true },
  severity: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  targetRole: { type: String },
}, { strict: false });
export const Alert = mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema, 'alert');

// 3. FiscalYear
/** FiscalYear interface definition */
export interface IFiscalYear extends Document {
  id: string;
  year: number;
  label: string;
  status: string;
  createdAt: Date;
  notes?: string;
}
/** FiscalYear Schema definition for MongoDB */
const FiscalYearSchema = new Schema<IFiscalYear>({
  id: { type: String, required: true, unique: true, index: true },
  year: { type: Number, required: true },
  label: { type: String, required: true },
  status: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  notes: { type: String },
}, { strict: false });
export const FiscalYear = mongoose.models.FiscalYear || mongoose.model<IFiscalYear>('FiscalYear', FiscalYearSchema, 'fiscal_years');

// 4. Transaction
export interface ITransaction extends Document {
  id: string;
  externalRef?: string;
  sourceSystem: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  category: string;
  timestamp: Date;
  performedBy: string;
  metadata?: any;
}
const TransactionSchema = new Schema<ITransaction>({
  id: { type: String, required: true, unique: true, index: true },
  externalRef: { type: String },
  sourceSystem: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true },
  status: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  performedBy: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
}, { strict: false });
export const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema, 'transactions');

// 5. Forecast
export interface IForecast extends Document {
  id?: string;
  month: string;
  projected: number;
  actual: number;
}
const ForecastSchema = new Schema<IForecast>({
  id: { type: String, index: true },
  month: { type: String, required: true, unique: true, index: true },
  projected: { type: Number, required: true },
  actual: { type: Number, required: true },
}, { strict: false });
export const Forecast = mongoose.models.Forecast || mongoose.model<IForecast>('Forecast', ForecastSchema, 'forecast');

// 6. Report
export interface IReport extends Document {
  id: string;
  title: string;
  description: string;
  generatedBy: string;
  generatedById: string;
  timestamp: Date;
  period: string;
  stats: any;
  filters: any;
  itemCount: number;
}
const ReportSchema = new Schema<IReport>({
  id: { type: String, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  generatedBy: { type: String, required: true },
  generatedById: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  period: { type: String, required: true },
  stats: { type: Schema.Types.Mixed, required: true },
  filters: { type: Schema.Types.Mixed, required: true },
  itemCount: { type: Number, required: true },
}, { strict: false });
export const Report = mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema, 'reports');

// 7. Permission
export interface IPermission extends Document {
  id: string;
  role: string;
  access: any;
  actions: any;
}
const PermissionSchema = new Schema<IPermission>({
  id: { type: String, index: true },
  role: { type: String, required: true, unique: true, index: true },
  access: { type: Schema.Types.Mixed, required: true },
  actions: { type: Schema.Types.Mixed, required: true },
}, { strict: false });
export const Permission = mongoose.models.Permission || mongoose.model<IPermission>('Permission', PermissionSchema, 'permissions');

// 8. Threshold
export interface IThreshold extends Document {
  id: string;
  type: string;
  threshold: number;
  isEnabled: boolean;
  notifyEmail: boolean;
}
const ThresholdSchema = new Schema<IThreshold>({
  id: { type: String, index: true },
  type: { type: String, required: true },
  threshold: { type: Number, required: true },
  isEnabled: { type: Boolean, default: true },
  notifyEmail: { type: Boolean, default: false },
}, { strict: false });
export const Threshold = mongoose.models.Threshold || mongoose.model<IThreshold>('Threshold', ThresholdSchema, 'thresholds');

// 9. ChurchGroup
export interface IChurchGroup extends Document {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}
const ChurchGroupSchema = new Schema<IChurchGroup>({
  id: { type: String, index: true },
  name: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { strict: false });
export const ChurchGroup = mongoose.models.ChurchGroup || mongoose.model<IChurchGroup>('ChurchGroup', ChurchGroupSchema, 'church_groups');

// 10. LedgerBook
export interface ILedgerBook extends Document {
  id: string;
  ministryId?: string;
  ministryName: string;
  bookName?: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  creatorName?: string;
  budgetLimit: number;
  spentAmount: number;
  notes?: string;
  status: string;
}
const LedgerBookSchema = new Schema<ILedgerBook>({
  id: { type: String, index: true },
  ministryId: { type: String },
  ministryName: { type: String, required: true },
  bookName: { type: String },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  creatorName: { type: String },
  budgetLimit: { type: Number, required: true },
  spentAmount: { type: Number, default: 0 },
  notes: { type: String },
  status: { type: String, default: 'ACTIVE' },
}, { strict: false });
export const LedgerBook = mongoose.models.LedgerBook || mongoose.model<ILedgerBook>('LedgerBook', LedgerBookSchema, 'ledger_books');

// 11. SupplementaryBudget
export interface ISupplementaryBudget extends Document {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  role: string;
  projectId: string;
  projectName: string;
  amount: number;
  justification: string;
  submittedAt: Date;
  status: string;
}
const SupplementaryBudgetSchema = new Schema<ISupplementaryBudget>({
  id: { type: String, index: true },
  requesterId: { type: String, required: true },
  requesterName: { type: String, required: true },
  requesterEmail: { type: String, required: true },
  role: { type: String, required: true },
  projectId: { type: String, required: true },
  projectName: { type: String, required: true },
  amount: { type: Number, required: true },
  justification: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'PENDING' },
}, { strict: false });
export const SupplementaryBudget = mongoose.models.SupplementaryBudget || mongoose.model<ISupplementaryBudget>('SupplementaryBudget', SupplementaryBudgetSchema, 'supplementary_budgets');

// 12. Vendor
export interface IVendor extends Document {
  id: string;
  name: string;
  contact?: string;
  location?: string;
  offerings?: string;
  createdAt: Date;
  addedBy: string;
  status: string;
}
const VendorSchema = new Schema<IVendor>({
  id: { type: String, index: true },
  name: { type: String, required: true },
  contact: { type: String },
  location: { type: String },
  offerings: { type: String },
  createdAt: { type: Date, default: Date.now },
  addedBy: { type: String, required: true },
  status: { type: String, default: 'PENDING' },
}, { strict: false });
export const Vendor = mongoose.models.Vendor || mongoose.model<IVendor>('Vendor', VendorSchema, 'vendors');

// 13. Settings
export interface ISettings extends Document {
  id: string;
  currentFiscalYear: number;
  fiscalYearStatus: string;
  announcementIsActive?: boolean;
  announcementMessage?: string;
  announcementType?: string;
  hideSupplementaryBudgetBtn?: boolean;
  vendorListViewLevel?: string;
  isSystemOffline?: boolean;
  requisitionExpiryDays?: number;
  unapprovedSummaryEmailEnabled?: boolean;
  unapprovedSummaryEmailFrequencyDays?: number;
  lastUnapprovedSummaryEmailSentAt?: string;
  unapprovedSummaryEmailRecipients?: string;
  [key: string]: any;
}
const SettingsSchema = new Schema<ISettings>({
  id: { type: String, required: true, unique: true, index: true },
  currentFiscalYear: { type: Number, default: 2026 },
  fiscalYearStatus: { type: String, default: 'OPEN' },
}, { strict: false });
export const Settings = mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema, 'settings');

// 14. UserReactionHistory
export interface IUserReactionHistory extends Document {
  id: string;
  requisitionId: string;
  commentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  emoji: string;
  action: 'ADDED' | 'REMOVED' | 'TOGGLED';
  timestamp: Date;
  previousEmoji?: string;
  metadata?: any;
}

const UserReactionHistorySchema = new Schema<IUserReactionHistory>({
  id: { type: String, required: true, index: true },
  requisitionId: { type: String, required: true, index: true },
  commentId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  emoji: { type: String, required: true },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  previousEmoji: { type: String },
  metadata: { type: Schema.Types.Mixed },
}, { strict: false });

export const UserReactionHistory = mongoose.models.UserReactionHistory || mongoose.model<IUserReactionHistory>('UserReactionHistory', UserReactionHistorySchema, 'user_reaction_histories');
