import mongoose, { Schema, Document } from 'mongoose';

/** Project interface definition */
export interface IProject extends Document {
  id: string;
  name: string;
  groupId: string;
  allocatedBudget: number;
  spentAmount: number;
  committedAmount: number;
  status: string;
  color?: string;
  fiscalYear?: number;
  requisitionLimit?: number;
  accountNumber?: string;
  createdAt: Date;
}

/** Project Schema definition for MongoDB */
const ProjectSchema = new Schema<IProject>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  groupId: { type: String, required: true },
  allocatedBudget: { type: Number, required: true },
  spentAmount: { type: Number, default: 0 },
  committedAmount: { type: Number, default: 0 },
  status: { type: String, default: 'ACTIVE' },
  color: { type: String },
  fiscalYear: { type: Number },
  requisitionLimit: { type: Number },
  accountNumber: { type: String },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: false },
  strict: false,
});

export const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema, 'projects');
