import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface IFamily extends Document {
  id: string;
  name: string;
  createdAt: string;
}

export interface IGroup extends Document {
  id: string;
  name: string;
  familyId: string;
}

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  groupId: string;
  role: 'admin' | 'member';
}

export interface IExpense extends Document {
  id: string;
  amount: number;
  category: string;
  paidBy: string;
  groupId: string;
  date: string;
  notes: string;
  merchant: string;
  originalImage?: string;
  createdAt: string;
}

export interface ISettlement extends Document {
  id: string;
  fromGroup: string;
  toGroup: string;
  amount: number;
  status: 'pending' | 'settled';
  date: string;
  notes?: string;
  settledAt?: string;
}

export interface IWhatsAppChat extends Document {
  id: string;
  sender: 'user' | 'bot';
  senderName?: string;
  text: string;
  timestamp: string;
  image?: string;
  meta?: Record<string, unknown>;
}

export interface IAdvisorChat extends Document {
  id: string;
  userId: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

// ── Helper: get cached model or create it (safe for serverless warm starts) ──

function getModel<T extends Document>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

// 1. Family Schema
const FamilySchema = new Schema<IFamily>({
  id:        { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  createdAt: { type: String, required: true }
});
export const FamilyModel = getModel<IFamily>('Family', FamilySchema);

// 2. Group Schema
const GroupSchema = new Schema<IGroup>({
  id:       { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  familyId: { type: String, required: true }
});
export const GroupModel = getModel<IGroup>('Group', GroupSchema);

// 3. User Schema (with secure password hashed storage support)
const UserSchema = new Schema<IUser>({
  id:       { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  groupId:  { type: String, required: true },
  role:     { type: String, enum: ['admin', 'member'], default: 'member' }
});
export const UserModel = getModel<IUser>('User', UserSchema);

// 4. Expense Schema
const ExpenseSchema = new Schema<IExpense>({
  id:            { type: String, required: true, unique: true },
  amount:        { type: Number, required: true },
  category:      { type: String, required: true },
  paidBy:        { type: String, required: true },
  groupId:       { type: String, required: true },
  date:          { type: String, required: true },
  notes:         { type: String, default: '' },
  merchant:      { type: String, default: '' },
  originalImage: { type: String },
  createdAt:     { type: String, required: true }
});
export const ExpenseModel = getModel<IExpense>('Expense', ExpenseSchema);

// 5. Settlement Schema
const SettlementSchema = new Schema<ISettlement>({
  id:        { type: String, required: true, unique: true },
  fromGroup: { type: String, required: true },
  toGroup:   { type: String, required: true },
  amount:    { type: Number, required: true },
  status:    { type: String, enum: ['pending', 'settled'], default: 'pending' },
  date:      { type: String, required: true },
  notes:     { type: String },
  settledAt: { type: String }
});
export const SettlementModel = getModel<ISettlement>('Settlement', SettlementSchema);

// 6. WhatsApp Chat Simulation Schema
const WhatsAppChatSchema = new Schema<IWhatsAppChat>({
  id:         { type: String, required: true, unique: true },
  sender:     { type: String, enum: ['user', 'bot'], required: true },
  senderName: { type: String },
  text:       { type: String, required: true },
  timestamp:  { type: String, required: true },
  image:      { type: String },
  meta:       { type: Schema.Types.Mixed }
});
export const WhatsAppChatModel = getModel<IWhatsAppChat>('WhatsAppChat', WhatsAppChatSchema);

// 7. Advisor Chat History Schema
const AdvisorChatSchema = new Schema<IAdvisorChat>({
  id:        { type: String, required: true, unique: true },
  userId:    { type: String, required: true },
  role:      { type: String, enum: ['user', 'model'], required: true },
  text:      { type: String, required: true },
  timestamp: { type: String, required: true }
});
export const AdvisorChatModel = getModel<IAdvisorChat>('AdvisorChat', AdvisorChatSchema);
