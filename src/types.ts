/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Family {
  id: string;
  name: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  familyId: string;
  monthlyBudget?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  groupId: string; // ID of the belonging group
  role: 'admin' | 'member';
  whatsappNumber?: string;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  paidBy: string; // userId
  groupId: string; // groupId of the user who paid
  date: string; // YYYY-MM-DD
  notes: string;
  merchant: string;
  originalImage?: string; // base64 URL or standard reference
  createdAt: string;
}

export interface Settlement {
  id: string;
  fromGroup: string; // groupId
  toGroup: string; // groupId
  amount: number;
  status: 'pending' | 'settled';
  date: string;
  notes?: string;
  settledAt?: string;
  billingMonth?: string;
}

export interface AdvisorMessage {
  id: string;
  userId: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  userId: string; // specific user ID or 'all'
  title: string;
  message: string;
  type: 'reminder' | 'settlement' | 'alert' | 'system';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface DBState {
  family: Family;
  groups: Group[];
  users: User[];
  expenses: Expense[];
  settlements: Settlement[];
  notifications?: NotificationItem[];
  whatsappChat: {
    id: string;
    sender: 'user' | 'bot';
    senderName?: string;
    text: string;
    timestamp: string;
    meta?: any;
    image?: string;
  }[];
  advisorChat?: AdvisorMessage[];
}
