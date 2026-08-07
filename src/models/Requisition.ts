import mongoose, { Schema, Document } from 'mongoose';

/** Requisition interface definition */
export interface IRequisition extends Document {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  amount: number;
  amountWords?: string;
  groupId: string;
  groupName: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  status: string;
  submittedAt?: Date;
  updatedAt: Date;
  expiresAt?: Date;
  escalationLevel: number;
  escalationNotificationsSent: boolean;
  approvedAtL1?: Date;
  approvedAtL2?: Date;
  disbursedAt?: Date;
  rejectionReason?: string;
  approvalHistory: any[];
  digitalSignature?: string;
  payableTo?: string;
  recurrence?: string;
  lastRecurrenceGeneratedAt?: Date;
  additionalInfo?: string;
  attachments: any[];
  receipts: any[];
  comments?: any[];
  flaggedForAudit: boolean;
  inProcurement: boolean;
  requiresMoreInfo: boolean;
  fiscalYear?: number;
}

/** Requisition Schema definition for MongoDB */
const RequisitionSchema = new Schema<IRequisition>({
  id: { type: String, required: true, unique: true, index: true },
  projectId: { type: String, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  amountWords: { type: String },
  groupId: { type: String, required: true, index: true },
  groupName: { type: String, required: true },
  requesterId: { type: String, required: true, index: true },
  requesterName: { type: String, required: true },
  requesterEmail: { type: String },
  status: { type: String, required: true },
  submittedAt: { type: Date },
  expiresAt: { type: Date },
  escalationLevel: { type: Number, default: 0 },
  escalationNotificationsSent: { type: Boolean, default: false },
  approvedAtL1: { type: Date },
  approvedAtL2: { type: Date },
  disbursedAt: { type: Date },
  rejectionReason: { type: String },
  approvalHistory: { type: [Schema.Types.Mixed], default: [] } as any,
  digitalSignature: { type: String },
  payableTo: { type: String },
  recurrence: { type: String },
  lastRecurrenceGeneratedAt: { type: Date },
  additionalInfo: { type: String },
  attachments: { type: [Schema.Types.Mixed], default: [] } as any,
  receipts: { type: [Schema.Types.Mixed], default: [] } as any,
  comments: { type: [Schema.Types.Mixed], default: [] } as any,
  flaggedForAudit: { type: Boolean, default: false },
  inProcurement: { type: Boolean, default: false },
  requiresMoreInfo: { type: Boolean, default: false },
  fiscalYear: { type: Number },
}, {
  timestamps: true,
  strict: false,
});

export const Requisition = mongoose.models.Requisition || mongoose.model<IRequisition>('Requisition', RequisitionSchema, 'requisitions');
