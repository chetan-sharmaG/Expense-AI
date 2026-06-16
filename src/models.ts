import mongoose, { Schema } from 'mongoose';

// 1. Family Schema
const FamilySchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  createdAt: { type: String, required: true }
});
export const FamilyModel = mongoose.model('Family', FamilySchema);

// 2. Group Schema
const GroupSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  familyId: { type: String, required: true }
});
export const GroupModel = mongoose.model('Group', GroupSchema);

// 3. User Schema (with secure password hashed storage support)
const UserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // secure hashed storage
  groupId: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' }
});
export const UserModel = mongoose.model('User', UserSchema);

// 4. Expense Schema
const ExpenseSchema = new Schema({
  id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  paidBy: { type: String, required: true },
  groupId: { type: String, required: true },
  date: { type: String, required: true },
  notes: { type: String, default: '' },
  merchant: { type: String, default: '' },
  originalImage: { type: String },
  createdAt: { type: String, required: true }
});
export const ExpenseModel = mongoose.model('Expense', ExpenseSchema);

// 5. Settlement Schema
const SettlementSchema = new Schema({
  id: { type: String, required: true, unique: true },
  fromGroup: { type: String, required: true },
  toGroup: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'settled'], default: 'pending' },
  date: { type: String, required: true },
  notes: { type: String },
  settledAt: { type: String }
});
export const SettlementModel = mongoose.model('Settlement', SettlementSchema);

// 6. WhatsApp Chat Simulation Schema
const WhatsAppChatSchema = new Schema({
  id: { type: String, required: true, unique: true },
  sender: { type: String, enum: ['user', 'bot'], required: true },
  senderName: { type: String },
  text: { type: String, required: true },
  timestamp: { type: String, required: true },
  image: { type: String },
  meta: { type: Schema.Types.Mixed }
});
export const WhatsAppChatModel = mongoose.model('WhatsAppChat', WhatsAppChatSchema);

// 7. Advisor Chat History Schema
const AdvisorChatSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  role: { type: String, enum: ['user', 'model'], required: true },
  text: { type: String, required: true },
  timestamp: { type: String, required: true }
});
export const AdvisorChatModel = mongoose.model('AdvisorChat', AdvisorChatSchema);
