import mongoose, { Schema, Document } from 'mongoose';

/** User interface definition */
export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  role: string;
  group?: string;
  groups?: string[];
  approverCode?: string;
  isActive: boolean;
  isApproved: boolean;
  isSuspended: boolean;
  phone?: string;
  department?: string;
  photoURL?: string;
  tempPassword?: string;
  isOnline?: boolean;
  lastSeen?: Date;
  idleTimeoutDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

/** User Schema definition for MongoDB */
const UserSchema = new Schema<IUser>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  role: { type: String, required: true },
  group: { type: String },
  groups: { type: [String], default: [] },
  approverCode: { type: String },
  isActive: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  phone: { type: String },
  department: { type: String },
  photoURL: { type: String },
  tempPassword: { type: String },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date },
  idleTimeoutDuration: { type: Number, default: 15 },
}, {
  timestamps: true,
  strict: false,
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema, 'users');
