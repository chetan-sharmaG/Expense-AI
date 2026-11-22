/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dns from 'dns';
try {
  // Use public DNS to reliably resolve MongoDB Atlas SRV connection strings on Windows
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore if unsupported in environment
}

import dotenv from 'dotenv';
import path from 'path';

// Load local environment settings
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

import express from 'express';
// NOTE: Vite is loaded via dynamic import inside startServer() to avoid loading
// Vite's dev-server infrastructure in production/serverless environments.
import { GoogleGenAI, Type } from '@google/genai';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import webpush from 'web-push';
import cron from 'node-cron';
import {
  FamilyModel,
  GroupModel,
  UserModel,
  ExpenseModel,
  SettlementModel,
  WhatsAppChatModel,
  AdvisorChatModel,
  WhatsAppSessionModel,
  ProcessedMessageModel,
  PushSubscriptionModel,
  NotificationModel
} from './src/models';

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'family_funds_development_jwt_secret_token_key_123!';

// Serve static assets from public/ (including sw.js and manifest.json)
app.use(express.static(path.join(process.cwd(), 'public')));

// Set up larger limits for base64 uploads (receipt screenshots)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ------------------- GLOBAL DIAGNOSTIC API LOGGER -------------------
app.use((req: any, res: any, next: any) => {
  // Only log API routes to avoid cluttering assets/Vite HMR logs
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = new Date().toLocaleTimeString('en-IN', { hour12: false });

  // Sanitize request body for console logging (truncate large base64 or long payloads)
  const sanitize = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.slice(0, 5).map(sanitize);
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && (v.startsWith('data:image/') || v.length > 300)) {
        clean[k] = `[string ${(v.length / 1024).toFixed(1)} KB]`;
      } else if (typeof v === 'object' && v !== null) {
        clean[k] = sanitize(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  };

  const hasBody = req.body && Object.keys(req.body).length > 0;
  const sanitizedBody = hasBody ? JSON.stringify(sanitize(req.body)) : '';
  const queryStr = req.query && Object.keys(req.query).length > 0 ? ` ?${new URLSearchParams(req.query as any).toString()}` : '';

  console.log(`\n🔍 [API REQ #${requestId}] ${timestamp} ➡️  ${req.method} ${req.path}${queryStr}${sanitizedBody ? `\n   Payload: ${sanitizedBody}` : ''}`);

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const code = res.statusCode;
    const statusIcon = code < 300 ? '✅' : code < 400 ? 'ℹ️' : code < 500 ? '⚠️' : '❌';
    const user = req.user ? ` (User: ${req.user.name || req.user.email || req.user.id})` : '';

    console.log(`🏁 [API RES #${requestId}] ${statusIcon} ${req.method} ${req.path} → Status ${code} (${duration}ms)${user}`);
  });

  next();
});

// ------------------- WEB PUSH & VAPID SETUP -------------------
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BJlvnnGBn3rW4arLFz18XEPLRwJBjMC8CLnyiBqXghGWR9JHu2RBe22Fqt5WABY9IV9bk80zYVabygYAKsDJGKQ';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'p325TPq1D7ciUYjPK1Ka7rLJ6Q2IS6f7C90c4-P-fYc';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@familyfunds.app';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[WebPush] VAPID details configured successfully.');
} catch (err: any) {
  console.error('[WebPush] Failed to set VAPID details:', err.message || err);
}

// ------------------- JWT MIDDLEWARE -------------------
function authenticateJWT(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
      }
      req.user = decoded;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: Missing auth token' });
  }
}

// ------------------- DATABASE STATE FETCH HELPER -------------------
async function getDBState(userId?: string) {
  const [family, groups, users, expenses, settlements, whatsappChat, advisorChat, notifications] = await Promise.all([
    FamilyModel.findOne().lean(),
    GroupModel.find().lean(),
    UserModel.find({}, { password: 0 }).lean(), // Exclude passwords from UI payload
    ExpenseModel.find().lean(),
    SettlementModel.find().lean(),
    WhatsAppChatModel.find().lean(),
    userId ? AdvisorChatModel.find({ userId }).sort({ timestamp: 1 }).lean() : [],
    userId ? NotificationModel.find({ $or: [{ userId }, { userId: 'all' }] }).sort({ createdAt: -1 }).limit(30).lean() : []
  ]);

  return {
    family,
    groups,
    users,
    expenses,
    settlements,
    notifications: notifications || [],
    whatsappChat,
    advisorChat
  };
}

// ------------------- STANDARD CATEGORIES & NORMALIZATION -------------------
export const STANDARD_CATEGORIES = [
  'Outside Food',
  'Veggies',
  'Fruits',
  'DMART',
  'Bills',
  'Mislenious',
  'Milk',
  'Dining'
];

export function normalizeCategory(category?: string | null): string {
  if (!category) return 'Mislenious';
  const clean = category.trim().toLowerCase();

  // 1. Direct standard matches
  for (const cat of STANDARD_CATEGORIES) {
    if (cat.toLowerCase() === clean) return cat;
  }

  // 2. Synonyms & legacy mappings:
  // DMART
  if (['groceries', 'grocery', 'dmart', 'd-mart', 'supermarket', 'kirana', 'provisions', 'household', 'shopping', 'amazon', 'flipkart', 'staples', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'ration'].some(k => clean.includes(k))) {
    return 'DMART';
  }
  // Veggies
  if (['vegetable', 'vegetables', 'veggie', 'veggies', 'sabzi', 'sabji', 'greens', 'bhaji'].some(k => clean.includes(k))) {
    return 'Veggies';
  }
  // Fruits
  if (['fruit', 'fruits'].some(k => clean.includes(k))) {
    return 'Fruits';
  }
  // Milk
  if (['milk', 'dairy', 'curd', 'paneer', 'butter', 'ghee', 'doodh', 'amul'].some(k => clean.includes(k))) {
    return 'Milk';
  }
  // Dining
  if (['dining', 'dining out', 'restaurant', 'cafe', 'bistro', 'hotel', 'eatery', 'buffet'].some(k => clean.includes(k))) {
    return 'Dining';
  }
  // Outside Food
  if (['outside food', 'fast food', 'street food', 'swiggy', 'zomato', 'takeaway', 'snack', 'snacks', 'food', 'tea', 'coffee', 'chai', 'bakery'].some(k => clean.includes(k))) {
    return 'Outside Food';
  }
  // Bills
  if (['bill', 'bills', 'utilit', 'electric', 'power', 'water', 'gas', 'lpg', 'wifi', 'internet', 'broadband', 'recharge', 'maintenance', 'rent', 'subscription', 'insurance', 'emi', 'tax'].some(k => clean.includes(k))) {
    return 'Bills';
  }
  // Mislenious / Miscellaneous / Medical / Fuel / Transport / Others
  if (['misc', 'other', 'general', 'medical', 'medicine', 'pharmacy', 'health', 'fuel', 'petrol', 'diesel', 'travel', 'transport', 'cab', 'auto', 'uber', 'ola', 'entertainment', 'movie', 'education', 'invest'].some(k => clean.includes(k))) {
    return 'Mislenious';
  }

  return 'Mislenious';
}

// ------------------- WEB PUSH & NOTIFICATION HELPERS -------------------
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Dispatch push notification to a single device subscription
export async function sendPushToSubscription(subscription: any, payload: PushPayload) {
  try {
    const pushConfig = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    };
    const stringified = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || 'familyfunds-reminder',
      data: {
        url: payload.url || '/expenses?action=add'
      }
    });
    await webpush.sendNotification(pushConfig, stringified);
    return true;
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`[WebPush] Subscription expired or gone (${err.statusCode}). Removing endpoint: ${subscription.endpoint}`);
      await PushSubscriptionModel.deleteOne({ endpoint: subscription.endpoint }).catch(() => {});
    } else {
      console.error('[WebPush] Error sending push notification:', err.message || err);
    }
    return false;
  }
}

// Broadcast reminder: creates in-app notification for all users + pushes to all subscribed devices
export async function broadcastLedgerReminder(title: string, message: string, actionUrl: string = '/expenses?action=add') {
  console.log(`[Notification Engine] Broadcasting reminder: "${title}" - "${message}"`);

  // 1. Create In-App Notification records for all family users
  const users = await UserModel.find().lean();
  const notifId = `notif-${Date.now()}`;
  const createdAt = new Date().toISOString();

  const notificationsToInsert = users.map(u => ({
    id: `${notifId}-${u.id}`,
    userId: u.id,
    title,
    message,
    type: 'reminder',
    read: false,
    createdAt,
    actionUrl
  }));

  if (notificationsToInsert.length > 0) {
    await NotificationModel.insertMany(notificationsToInsert).catch(err => {
      console.error('[Notification Engine] Failed to save in-app notifications:', err);
    });
  }

  // 2. Fetch all registered Web Push device subscriptions
  const subscriptions = await PushSubscriptionModel.find().lean();
  console.log(`[Notification Engine] Found ${subscriptions.length} registered push subscriptions.`);

  let deliveredCount = 0;
  let failedCount = 0;

  for (const sub of subscriptions) {
    const ok = await sendPushToSubscription(sub, {
      title,
      body: message,
      url: actionUrl,
      tag: 'familyfunds-reminder'
    });
    if (ok) deliveredCount++;
    else failedCount++;
  }

  console.log(`[Notification Engine] Broadcast finished: ${deliveredCount} delivered, ${failedCount} failed.`);
  return {
    deliveredCount,
    failedCount,
    totalSubscriptions: subscriptions.length,
    usersCount: users.length
  };
}

// ------------------- CRON SCHEDULES (15th & LAST DAY) -------------------
export function initNotificationCronJobs() {
  console.log('[Cron] Initializing Ledger Reminder Cron Schedules (Asia/Kolkata timezone)...');

  // 1. Mid-Month Ledger Reminder: Runs at 09:00 AM on the 15th of every month
  cron.schedule('0 9 15 * *', async () => {
    console.log('[Cron] Firing Mid-Month Ledger Reminder (15th of the month)...');
    await broadcastLedgerReminder(
      '📅 Mid-Month Ledger Check-in',
      'Friendly mid-month reminder! Make sure to log any pending receipts, grocery bills, or shared expenses for the first half of the month.'
    );
  }, { timezone: 'Asia/Kolkata' });

  // 2. Month-End Ledger Reminder: Evaluates daily on 28-31 at 09:00 AM to detect the last day
  cron.schedule('0 9 28-31 * *', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isLastDay = tomorrow.getDate() === 1;

    if (isLastDay) {
      console.log('[Cron] Firing Month-End Ledger Reminder (Last day of the month)...');
      await broadcastLedgerReminder(
        '🏁 Month-End Ledger Wrap-up',
        'The month is ending today! Please record all remaining expenditures and bills before month-end settlements are calculated.'
      );
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[Cron] Scheduled reminders active: 15th & Last Day of every month.');
}

// ------------------- DATABASE SEED LOGIC -------------------
export async function seedDatabase() {
  try {
    const familyCount = await FamilyModel.countDocuments();
    if (familyCount > 0) {
      console.log('Database already populated with family structures.');
      return;
    }

    const familyId = 'fam-1';
    await FamilyModel.create({
      id: familyId,
      name: 'Sharma Family Assembly',
      createdAt: new Date().toISOString()
    });

    const groups = [
      { id: 'grp-1', name: 'Couple 1 (Naveen & Sneha)', familyId },
      { id: 'grp-2', name: 'Couple 2 (Chetan & Riyati)', familyId }
    ];
    await GroupModel.insertMany(groups);

    const whatsappChat = [
      {
        id: 'chat-1',
        sender: 'bot' as const,
        text: 'Hello Sharma Family! I am FamBudget, your automated Expense Agent. 🤖📱\n\nSend me text like "Paid ₹850 for vegetables" or drop any mobile transaction screenshot (GPay, PhonePe, Paytm, etc.) right here to instantly log expenses!',
        timestamp: new Date().toISOString()
      }
    ];
    await WhatsAppChatModel.insertMany(whatsappChat);

    console.log('Seeding Sharma Family structures complete!');
  } catch (err) {
    console.error('Failed to seed default Sharma Family database:', err);
  }
}

// Lazy load server-side Gemini client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('GEMINI_API_KEY is not configured in environment variables.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key || 'MOCK_KEY_IF_ABSENT',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Reusable Groq API client helper using native fetch with automatic model fallback
async function callGroqChat(messages: { role: string; content: string }[], jsonMode: boolean = false): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GROQ_API_KEY is not configured in environment variables.');
  }

  const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Groq] Model ${model} returned ${response.status}: ${errorText}`);
        lastError = new Error(`Groq API error (status ${response.status}): ${errorText}`);
        // If rate limited or request too large, fallback to smaller model
        if (response.status === 429 || response.status === 413 || response.status === 503) {
          continue;
        }
        throw lastError;
      }

      const data: any = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      lastError = err;
      console.warn(`[Groq] Attempt with ${model} failed:`, err.message || err);
    }
  }

  throw lastError || new Error('All Groq models failed');
}

// ------------------- API ROUTES -------------------

// Auth APIs: Register New Profile
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, groupId, role, whatsappNumber } = req.body;
  console.log(`[Auth Register] Request body name=${name}, email=${email}, groupId=${groupId}, role=${role}, whatsappNumber=${whatsappNumber}`);
  if (!name || !email || !password || !groupId) {
    console.warn('[Auth Register] Missing mandatory credentials');
    return res.status(400).json({ error: 'Missing mandatory registration credentials' });
  }

  try {
    const userExists = await UserModel.findOne({ email: email.toLowerCase() });
    if (userExists) {
      console.warn(`[Auth Register] Email already exists: ${email}`);
      return res.status(400).json({ error: 'A member profile with this email is already registered' });
    }

    const cleanWhatsapp = whatsappNumber ? whatsappNumber.replace(/\D/g, '') : undefined;
    if (cleanWhatsapp) {
      const existingUser = await UserModel.findOne({ whatsappNumber: cleanWhatsapp });
      if (existingUser) {
        console.warn(`[Auth Register] WhatsApp number ${cleanWhatsapp} already linked to ${existingUser.name}`);
        return res.status(400).json({ error: `WhatsApp number is already linked to ${existingUser.name}` });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await UserModel.create({
      id: `usr-${Date.now()}`,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      groupId,
      role: role || 'member',
      whatsappNumber: cleanWhatsapp
    });

    console.log(`[Auth Register] Successfully created user: ${newUser.name} (${newUser.id}), WhatsApp: ${cleanWhatsapp}`);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET
    );

    res.json({
      success: true,
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, groupId: newUser.groupId, whatsappNumber: newUser.whatsappNumber }
    });
  } catch (err: any) {
    console.error('[Auth Register] Error registering user:', err);
    res.status(500).json({ error: 'Registration failed', message: err.message });
  }
});

// Auth APIs: Log in member profile
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, groupId: user.groupId }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

// Public APIs: Retrieve groups for registration dropdown
app.get('/api/public/groups', async (req, res) => {
  try {
    const groups = await GroupModel.find({}, { _id: 0 }).lean();
    res.json({ success: true, groups });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve groups', message: err.message });
  }
});

// Auth APIs: Retrieve current user verification
app.get('/api/auth/me', authenticateJWT, async (req: any, res) => {
  try {
    const user = await UserModel.findOne({ id: req.user.id }, { password: 0 });
    if (!user) return res.status(404).json({ error: 'Verified user profile not found' });
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Database State / Configs
app.get('/api/db-state', authenticateJWT, async (req: any, res) => {
  try {
    const state = await getDBState(req.user.id);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve state', message: err.message });
  }
});

// Reset system to factory default
app.post('/api/db-reset', async (req: any, res) => {
  try {
    console.log('[Admin Reset] Initiating factory reset...');
    await Promise.all([
      FamilyModel.deleteMany({}),
      GroupModel.deleteMany({}),
      UserModel.deleteMany({}),
      ExpenseModel.deleteMany({}),
      SettlementModel.deleteMany({}),
      WhatsAppChatModel.deleteMany({}),
      AdvisorChatModel.deleteMany({}),
      WhatsAppSessionModel.deleteMany({})
    ]);

    await seedDatabase();
    console.log('[Admin Reset] Factory reset complete. Database is clean and ready.');
    res.json({ success: true, message: 'Database successfully cleared and reset to factory defaults.' });
  } catch (err: any) {
    console.error('[Admin Reset] Factory reset failed:', err);
    res.status(500).json({ error: 'Database reset failed', message: err.message });
  }
});

// Reset expenses only (preserving users and groups)
app.post('/api/db-clean-expenses', authenticateJWT, async (req: any, res) => {
  try {
    console.log('[Expenses Reset] Clearing expenses, settlements, and chats while keeping users/groups...');
    await Promise.all([
      ExpenseModel.deleteMany({}),
      SettlementModel.deleteMany({}),
      WhatsAppChatModel.deleteMany({}),
      AdvisorChatModel.deleteMany({}),
      WhatsAppSessionModel.deleteMany({})
    ]);

    const state = await getDBState(req.user.id);
    console.log('[Expenses Reset] Expenses reset complete.');
    res.json({ success: true, message: 'All expense records, settlements, and chat histories successfully reset.', state });
  } catch (err: any) {
    console.error('[Expenses Reset] Reset failed:', err);
    res.status(500).json({ error: 'Failed to reset expenses', message: err.message });
  }
});

// Family & Group Management
app.post('/api/groups', authenticateJWT, async (req: any, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const family = await FamilyModel.findOne();
    const newGroup = await GroupModel.create({
      id: `grp-${Date.now()}`,
      name,
      familyId: family?.id || 'fam-1'
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, group: newGroup, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create group', message: err.message });
  }
});

app.delete('/api/groups/:id', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;

  try {
    // Reassign users of this group to first group
    const defaultGroup = await GroupModel.findOne({ id: { $ne: id } });
    await UserModel.updateMany({ groupId: id }, { groupId: defaultGroup?.id || '' });
    await GroupModel.deleteOne({ id });

    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete group', message: err.message });
  }
});

app.put('/api/groups/:id/budget', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { monthlyBudget } = req.body;

  try {
    await GroupModel.updateOne({ id }, {
      monthlyBudget: Number(monthlyBudget) || 0
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update group budget', message: err.message });
  }
});

app.post('/api/users', authenticateJWT, async (req: any, res) => {
  const { name, email, groupId, role, whatsappNumber } = req.body;
  if (!name || !email || !groupId) {
    return res.status(400).json({ error: 'Missing user parameters' });
  }

  try {
    const userExists = await UserModel.findOne({ email: email.toLowerCase() });
    if (userExists) return res.status(400).json({ error: 'Email already registered' });

    // Normalize whatsappNumber if provided (remove all non-digits)
    const cleanWhatsapp = whatsappNumber ? whatsappNumber.replace(/\D/g, '') : undefined;

    if (cleanWhatsapp) {
      const existingUser = await UserModel.findOne({ whatsappNumber: cleanWhatsapp });
      if (existingUser) {
        return res.status(400).json({ error: `WhatsApp number is already linked to ${existingUser.name}` });
      }
    }

    // Hash a placeholder password since administrative onboard does not require immediate password fill
    const salt = await bcrypt.genSalt(10);
    const placeHash = await bcrypt.hash('password123', salt);

    const newUser = await UserModel.create({
      id: `usr-${Date.now()}`,
      name,
      email: email.toLowerCase(),
      password: placeHash,
      groupId,
      role: role || 'member',
      whatsappNumber: cleanWhatsapp
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, user: newUser, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create user', message: err.message });
  }
});

app.put('/api/users/:id', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { name, email, groupId, role, whatsappNumber } = req.body;

  try {
    const user = await UserModel.findOne({ id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Normalize whatsappNumber if provided (remove all non-digits)
    const cleanWhatsapp = whatsappNumber ? whatsappNumber.replace(/\D/g, '') : undefined;

    // Check if whatsappNumber is already linked to another user
    if (cleanWhatsapp) {
      const existingUser = await UserModel.findOne({
        id: { $ne: id },
        whatsappNumber: cleanWhatsapp
      });
      if (existingUser) {
        return res.status(400).json({ error: `WhatsApp number is already linked to ${existingUser.name}` });
      }
    }

    await UserModel.updateOne({ id }, {
      name: name !== undefined ? name : user.name,
      email: email !== undefined ? email.toLowerCase() : user.email,
      groupId: groupId !== undefined ? groupId : user.groupId,
      role: role !== undefined ? role : user.role,
      whatsappNumber: whatsappNumber !== undefined ? cleanWhatsapp : user.whatsappNumber
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update member profile', message: err.message });
  }
});

app.delete('/api/users/:id', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  try {
    await UserModel.deleteOne({ id });
    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete user', message: err.message });
  }
});

// Expense CRUD
app.post('/api/expenses', authenticateJWT, async (req: any, res) => {
  const { amount, category, paidBy, date, notes, merchant, originalImage } = req.body;
  if (!amount || !paidBy || !date) {
    return res.status(400).json({ error: 'Missing vital expense parameters' });
  }

  try {
    const user = await UserModel.findOne({ id: paidBy });
    let groupId = user ? user.groupId : '';
    if (!groupId) {
      const defaultGroup = await GroupModel.findOne();
      groupId = defaultGroup?.id || '';
    }

    const newExpense = await ExpenseModel.create({
      id: `exp-${Date.now()}`,
      amount: Number(amount),
      category: normalizeCategory(category),
      paidBy,
      groupId,
      date,
      notes: notes || '',
      merchant: merchant || 'Unknown Merchant',
      originalImage,
      createdAt: new Date().toISOString()
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, expense: newExpense, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create expense', message: err.message });
  }
});

app.put('/api/expenses/:id', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { amount, category, paidBy, date, notes, merchant } = req.body;

  try {
    const expense = await ExpenseModel.findOne({ id });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const userProfile = await UserModel.findOne({ id: req.user.id });
    if (!userProfile) return res.status(401).json({ error: 'Unauthorized: Profile not found' });

    if (expense.groupId !== userProfile.groupId) {
      return res.status(403).json({ error: 'Forbidden: You cannot modify expenses belonging to another couple.' });
    }

    let groupId = expense.groupId;
    if (paidBy) {
      const user = await UserModel.findOne({ id: paidBy });
      if (user) groupId = user.groupId;
    }

    await ExpenseModel.updateOne({ id }, {
      amount: amount !== undefined ? Number(amount) : expense.amount,
      category: category ? normalizeCategory(category) : expense.category,
      paidBy: paidBy || expense.paidBy,
      groupId,
      date: date || expense.date,
      notes: notes ?? expense.notes,
      merchant: merchant || expense.merchant
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update expense', message: err.message });
  }
});

app.delete('/api/expenses/:id', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  try {
    const expense = await ExpenseModel.findOne({ id });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const userProfile = await UserModel.findOne({ id: req.user.id });
    if (!userProfile) return res.status(401).json({ error: 'Unauthorized: Profile not found' });

    if (expense.groupId !== userProfile.groupId) {
      return res.status(403).json({ error: 'Forbidden: You cannot delete expenses belonging to another couple.' });
    }

    await ExpenseModel.deleteOne({ id });
    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete expense', message: err.message });
  }
});

// Receipt OCR using server-side Gemini
app.post('/api/ocr', authenticateJWT, async (req, res) => {
  const { base64Image } = req.body;
  console.log(`[OCR Diagnostic] Received OCR request from user ${req.user?.name || req.user?.id || 'unknown'}`);

  if (!base64Image) {
    console.warn(`[OCR Diagnostic] ❌ Missing base64Image input in request body.`);
    return res.status(400).json({ error: 'Missing base64Image input for OCR' });
  }

  const imageKb = (base64Image.length / 1024).toFixed(1);
  console.log(`[OCR Diagnostic] Receipt image payload size: ~${imageKb} KB`);

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.trim() === '' || geminiKey === 'MY_GEMINI_API_KEY') {
    console.warn(`[OCR Diagnostic] ⚠️ GEMINI_API_KEY is not configured.`);
    return res.status(400).json({
      error: 'GEMINI_API_KEY_INVALID',
      message: 'GEMINI_API_KEY is required for receipt OCR. Please set GEMINI_API_KEY in your .env.local file.'
    });
  }

  try {
    const ai = getAiClient();
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
      You are an expert financial receipt reader. Please parse this payment screenshot (e.g., GPay, PhonePe, Paytm, BHIM, or static physical bill/receipt) and extract critical data.
      Analyze text, merchant details, payment confirmation, bank accounts numbers or reference IDs, and transaction amount very carefully.
      
      Look for payment confirmation status. Try to guess the appropriate category from standard options:
      - Outside Food
      - Veggies
      - Fruits
      - DMART
      - Bills
      - Mislenious
      - Milk
      - Dining
      
      Return ONLY a raw JSON structure matching these properties:
      {
        "amount": number,
        "merchant": "string",
        "date": "YYYY-MM-DD",
        "category": "suggested category",
        "notes": "short description"
      }
    `;

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let parsedData: any = null;
    let lastError: any = null;

    for (const model of models) {
      try {
        console.log(`[OCR Diagnostic] Calling Gemini API model "${model}"...`);
        const modelStart = Date.now();
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            },
            { text: prompt }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              required: ['amount', 'merchant', 'date', 'category', 'notes'],
              properties: {
                amount: { type: Type.NUMBER, description: 'The absolute total amount of the transaction.' },
                merchant: { type: Type.STRING, description: 'The business name or payee identity.' },
                date: { type: Type.STRING, description: 'Date of expenditure in YYYY-MM-DD format.' },
                category: { type: Type.STRING, description: 'Suggested business category.' },
                notes: { type: Type.STRING, description: 'Short summary note about the invoice payment.' }
              }
            }
          }
        });

        parsedData = JSON.parse(response.text || '{}');
        console.log(`[OCR Diagnostic] ✅ Successfully parsed with "${model}" in ${Date.now() - modelStart}ms! Extracted: amount=₹${parsedData.amount}, merchant="${parsedData.merchant}", category="${parsedData.category}", date="${parsedData.date}"`);
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[OCR Diagnostic] ⚠️ Attempt with "${model}" failed: ${err.message || err}`);
      }
    }

    if (!parsedData) {
      throw lastError || new Error('All Gemini OCR models failed.');
    }

    if (parsedData.category) {
      parsedData.category = normalizeCategory(parsedData.category);
    }
    res.json({ success: true, extracted: parsedData });

  } catch (error: any) {
    console.error('[OCR Diagnostic] ❌ OCR Extraction Failure:', error.message || error);
    let message = error.message || 'Unknown server error';
    if (message.includes('API key not valid') || message.includes('API_KEY_INVALID') || message.includes('UNAUTHENTICATED')) {
      message = 'Google Gemini API key is invalid or unauthorized. Please verify your GEMINI_API_KEY in .env.local.';
    }
    res.status(500).json({ error: 'Failed to run AI OCR', message });
  }
});

// Lazy Message Parser for simple amount/merchant strings
function parseLazyMessage(text: string) {
  const cleaned = text.trim()
    .replace(/[₹$,]/g, '')
    .replace(/\b(?:rs|inr|rupees)\b/gi, '')
    .trim();

  // 1. Number first (amount merchant)
  const numFirst = cleaned.match(/^(\d+(?:\.\d{1,2})?)\s+(.+)$/i);
  if (numFirst) {
    return {
      amount: parseFloat(numFirst[1]),
      merchant: numFirst[2].trim()
    };
  }

  // 2. Text first (merchant amount)
  const textFirst = cleaned.match(/^(.+?)\s+(\d+(?:\.\d{1,2})?)$/i);
  if (textFirst) {
    return {
      amount: parseFloat(textFirst[2]),
      merchant: textFirst[1].trim()
    };
  }

  return null;
}

// Financial Statistics Compiler for AI Bot Context
async function getFinancialStats() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Calculate start of current week (assuming Monday start)
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(today.setDate(diff)).toISOString().split('T')[0];

  const [expenses, groups, users] = await Promise.all([
    ExpenseModel.find(),
    GroupModel.find(),
    UserModel.find()
  ]);

  const groupMap = groups.reduce((acc, g) => ({ ...acc, [g.id]: g.name.split(' (')[0] }), {} as Record<string, string>);
  const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u.name }), {} as Record<string, string>);

  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
  const weekExpenses = expenses.filter(e => e.date >= startOfWeek);

  const totalMonthSpend = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalWeekSpend = weekExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Month breakdown by category
  const categoryBreakdown: Record<string, number> = {};
  monthExpenses.forEach(e => {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
  });

  // Month breakdown by group
  const groupBreakdown: Record<string, number> = {};
  monthExpenses.forEach(e => {
    const grpName = groupMap[e.groupId] || e.groupId;
    groupBreakdown[grpName] = (groupBreakdown[grpName] || 0) + e.amount;
  });

  // Month breakdown by user
  const userBreakdown: Record<string, number> = {};
  monthExpenses.forEach(e => {
    const uName = userMap[e.paidBy] || e.paidBy;
    userBreakdown[uName] = (userBreakdown[uName] || 0) + e.amount;
  });

  // Recent 5 expenses
  const sortedExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const recentExpenses = sortedExpenses.slice(0, 5).map(e => ({
    date: e.date,
    amount: e.amount,
    merchant: e.merchant,
    category: e.category,
    paidBy: userMap[e.paidBy] || e.paidBy,
    notes: e.notes
  }));

  return {
    currentMonth,
    totalMonthSpend,
    totalWeekSpend,
    categoryBreakdown,
    groupBreakdown,
    userBreakdown,
    recentExpenses
  };
}

// Programmatic command router for WhatsApp bot (bypasses Gemini AI for known queries)
async function handleProgrammaticCommand(text: string): Promise<string | null> {
  const query = text.trim().toLowerCase();

  // 1. Greetings & Help
  if (/^(hi|hello|hey|help|menu|commands|info|welcome|assistant)$/i.test(query)) {
    return `👋 *Hello! I am FamBudget, your automated Expense Agent.* 🤖📱\n\n` +
           `Here are the commands you can use:\n` +
           `• *summary* — Weekly and monthly spending summaries.\n` +
           `• *compare* — Couple/group spend contributions.\n` +
           `• *spenders* — Individual spend rankings.\n` +
           `• *settlement* — Current balance sheets (who owes whom).\n` +
           `• *categories* — Category-wise totals for this month.\n` +
           `• *search <keyword>* — Find matching expenses (e.g., "search Starbucks").\n\n` +
           `*To log a new expense:*\n` +
           `Simply send the text (e.g., "DMart 1500" or "Paid ₹850 for veggies") or upload a receipt screenshot! 🚀`;
  }

  // 2. Weekly/Monthly Summary
  if (/^(summary|spend this month|spent this month|spend this week|spent this week|month summary|week summary)$/i.test(query)) {
    const stats = await getFinancialStats();
    let recentStr = stats.recentExpenses.map((e, idx) => 
      `${idx + 1}. ${e.date}: *₹${e.amount}* at *${e.merchant}* (${e.paidBy})${e.notes ? ` - "${e.notes}"` : ''}`
    ).join('\n') || 'No recent transactions.';

    return `📊 *Expense Summary Report*\n\n` +
           `• *Current Month:* ${stats.currentMonth}\n` +
           `• *Monthly Spend:* ₹${stats.totalMonthSpend.toLocaleString('en-IN')}\n` +
           `• *Weekly Spend:* ₹${stats.totalWeekSpend.toLocaleString('en-IN')}\n\n` +
           `*Recent Transactions:*\n${recentStr}`;
  }

  // 3. Group Comparison
  if (/^(compare|group comparison|compare groups|couples comparison|group totals)$/i.test(query)) {
    const stats = await getFinancialStats();
    let breakStr = Object.entries(stats.groupBreakdown)
      .map(([group, amt]) => `• *${group}:* ₹${amt.toLocaleString('en-IN')}`)
      .join('\n') || 'No group spending logged this month.';

    return `👥 *Group Contribution & Spend Comparison*\n\n` +
           `Total spending mapped across couples and parents groups for this month:\n${breakStr}`;
  }

  // 4. Spenders / Individual Spend ranking
  if (/^(spenders|top spender|who spent the most|spender ranking)$/i.test(query)) {
    const stats = await getFinancialStats();
    let breakStr = Object.entries(stats.userBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([user, amt], idx) => `${idx + 1}. *${user}:* ₹${amt.toLocaleString('en-IN')}`)
      .join('\n') || 'No spender data logged this month.';

    return `👤 *Individual Spenders Leaderboard*\n\n` +
           `Individual spending contributions for this month:\n${breakStr}`;
  }

  // 5. Category Breakdown
  if (/^(categories|category totals|category breakdown)$/i.test(query)) {
    const stats = await getFinancialStats();
    let breakStr = Object.entries(stats.categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `• *${cat}:* ₹${amt.toLocaleString('en-IN')}`)
      .join('\n') || 'No category spending logged this month.';

    return `🏷️ *Category-wise Expenditure (Current Month)*\n\n${breakStr}`;
  }

  // 6. Settlement Calculations
  if (/^(settlement|settlements|debts|balances|who owes what)$/i.test(query)) {
    const [expenses, groups, users] = await Promise.all([
      ExpenseModel.find(),
      GroupModel.find(),
      UserModel.find()
    ]);

    const totalFamilySpend = expenses.reduce((sum, e) => sum + e.amount, 0);
    if (groups.length === 0) {
      return `💸 *Current Balances & Settlements*\n\nNo family groups configured yet.`;
    }

    const fairShare = totalFamilySpend / groups.length;
    const summaries = groups.map(g => {
      const groupSpent = expenses
        .filter(exp => exp.groupId === g.id)
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        groupId: g.id,
        groupName: g.name.split(' (')[0],
        totalSpent: groupSpent,
        fairShare,
        netBalance: groupSpent - fairShare
      };
    });

    const debtors = summaries.filter(s => s.netBalance < -0.01).map(s => ({ ...s, netBalance: Math.abs(s.netBalance) })).sort((a,b) => b.netBalance - a.netBalance);
    const creditors = summaries.filter(s => s.netBalance > 0.01).map(s => ({ ...s })).sort((a,b) => b.netBalance - a.netBalance);
    const proposals = [];
    
    let dIdx = 0, cIdx = 0;
    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      const minAmount = Math.min(debtor.netBalance, creditor.netBalance);
      if (minAmount > 0.1) {
        proposals.push({
          from: debtor.groupName,
          to: creditor.groupName,
          amount: Math.round(minAmount * 100) / 100
        });
      }
      debtor.netBalance -= minAmount;
      creditor.netBalance -= minAmount;
      if (debtor.netBalance < 0.1) dIdx++;
      if (creditor.netBalance < 0.1) cIdx++;
    }

    let propStr = proposals.map(p => `• *${p.from}* owes *${p.to}*: ₹${p.amount.toLocaleString('en-IN')}`).join('\n');
    if (!propStr) propStr = '🎉 All groups are perfectly settled! No outstanding balances.';

    return `💸 *Current Balances & Settlements*\n\n` +
           `• *Total Family Spend:* ₹${totalFamilySpend.toLocaleString('en-IN')}\n` +
           `• *Fair Share per Group:* ₹${Math.round(fairShare * 100) / 100}\n\n` +
           `*Outstanding Balances:*\n${propStr}`;
  }

  // 7. Expense Search (e.g., "search Starbucks")
  if (query.startsWith('search ')) {
    const searchTerm = text.trim().slice(7).trim();
    if (!searchTerm) {
      return `🔍 *Expense Search*\n\nPlease specify a keyword to search, e.g., "search Starbucks" or "search Groceries".`;
    }

    const matches = await ExpenseModel.find({
      $or: [
        { merchant: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } },
        { notes: { $regex: searchTerm, $options: 'i' } }
      ]
    }).sort({ date: -1 }).limit(10);

    const users = await UserModel.find();
    const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u.name }), {} as Record<string, string>);

    let matchStr = matches.map((e, idx) => 
      `${idx + 1}. ${e.date}: *₹${e.amount}* at *${e.merchant}* (${userMap[e.paidBy] || e.paidBy})${e.notes ? ` - "${e.notes}"` : ''}`
    ).join('\n');

    if (!matchStr) matchStr = `No matching expenses found for "${searchTerm}".`;

    return `🔍 *Search Results for "${searchTerm}"*\n\n${matchStr}`;
  }

  return null;
}

// WhatsApp Bot Chat Integration via AI Simulator
// WhatsApp AI Parsing helper
// Receipt OCR using server-side Gemini
async function runOcrOnReceipt(base64Image: string): Promise<{ amount: number; merchant: string; date: string; notes?: string } | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.trim() === '' || geminiKey === 'MY_GEMINI_API_KEY') {
    console.warn('[OCR Helper] GEMINI_API_KEY is not configured.');
    return null;
  }

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  
  for (const model of models) {
    let attempts = 0;
    const maxAttempts = 2;
    while (attempts < maxAttempts) {
      try {
        console.log(`[OCR Helper] Attempting OCR with model: ${model} (attempt ${attempts + 1}/${maxAttempts})...`);
        const ai = getAiClient();
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

        const prompt = `
          You are an expert financial receipt reader. Please parse this payment screenshot (e.g., GPay, PhonePe, Paytm, BHIM, or static physical bill/receipt) and extract critical data.
          Analyze text, merchant details, payment confirmation, bank accounts numbers or reference IDs, and transaction amount very carefully.
          
          Check if there is any message, note, remark, payment reason, or custom message written on the payment screenshot (for example: "for coffee", "lent", "rent share") and extract it in the "notes" field if present.
          
          Look for payment confirmation status. Try to guess the appropriate category from standard options:
          - Outside Food
          - Veggies
          - Fruits
          - DMART
          - Bills
          - Mislenious
          - Milk
          - Dining
          
          Return ONLY a raw JSON structure matching these properties:
          {
            "amount": number,
            "merchant": "string",
            "date": "YYYY-MM-DD",
            "notes": "short description"
          }
        `;

        const response = await ai.models.generateContent({
          model: model,
          contents: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            },
            { text: prompt }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              required: ['amount', 'merchant', 'date'],
              properties: {
                amount: { type: Type.NUMBER, description: 'The absolute total amount of the transaction.' },
                merchant: { type: Type.STRING, description: 'The business name or payee identity.' },
                date: { type: Type.STRING, description: 'Date of expenditure in YYYY-MM-DD format.' },
                notes: { type: Type.STRING, description: 'Short summary note about the invoice payment.' }
              }
            }
          }
        });

        const parsedData = JSON.parse(response.text || '{}');
        console.log(`[OCR Helper] OCR successful with model: ${model}`);
        return {
          amount: Number(parsedData.amount) || 0,
          merchant: parsedData.merchant || 'Unknown Merchant',
          date: parsedData.date || new Date().toISOString().split('T')[0],
          notes: parsedData.notes || ''
        };
      } catch (error: any) {
        attempts++;
        console.warn(`[OCR Helper] Attempt ${attempts} failed for model ${model}. Error:`, error.message || error);
        
        const isDepleted = error.message && (error.message.includes('prepayment credits') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('API_KEY_INVALID') || error.message.includes('UNAUTHENTICATED'));
        if (isDepleted && attempts >= 1) {
          break;
        }

        if (attempts < maxAttempts) {
          const delay = Math.pow(2, attempts) * 250;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }
  
  console.error('[OCR Helper] All receipt OCR models and attempts failed.');
  return null;
}

// WhatsApp Bot Chat Integration via AI Simulator
// WhatsApp AI Parsing helper
async function parseExpenseWithAi(
  text?: string,
  ocrData?: { amount: number; merchant: string; date: string; notes?: string } | null,
  senderUser?: any,
  activeSession?: any,
  traceId?: string
) {
  if (traceId) {
    console.log(`[${traceId}] parseExpenseWithAi called. text="${text || ''}" ocrData=${JSON.stringify(ocrData)} hasActiveSession=${!!activeSession}`);
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const [groupsList, usersList, stats] = await Promise.all([
    GroupModel.find(),
    UserModel.find(),
    getFinancialStats()
  ]);

  const groupsString = groupsList.map(g => `Group ID: ${g.id}, Name: ${g.name}`).join('\n');
  const usersString = usersList.map(u => `User Name: ${u.name}, ID: ${u.id}, Group: ${u.groupId}`).join('\n');
  const categoriesList = [
    'Outside Food',
    'Veggies',
    'Fruits',
    'DMART',
    'Bills',
    'Mislenious',
    'Milk',
    'Dining'
  ];

  const userGroup = senderUser ? groupsList.find(g => g.id === senderUser.groupId) : null;
  const senderName = senderUser ? senderUser.name : 'Unknown User';

  const statsString = `
Current Month (${stats.currentMonth}) Total Spend: ₹${stats.totalMonthSpend}
Current Week Total Spend: ₹${stats.totalWeekSpend}

Spend by Category this month:
${Object.entries(stats.categoryBreakdown).map(([cat, amt]) => `- ${cat}: ₹${amt}`).join('\n') || 'None'}

Spend by Couple/Group this month:
${Object.entries(stats.groupBreakdown).map(([grp, amt]) => `- ${grp}: ₹${amt}`).join('\n') || 'None'}

Spend by Member this month:
${Object.entries(stats.userBreakdown).map(([usr, amt]) => `- ${usr}: ₹${amt}`).join('\n') || 'None'}

Recent 5 expenses logged:
${stats.recentExpenses.map(e => `- Date: ${e.date}, Amount: ₹${e.amount}, Merchant: ${e.merchant}, Category: ${e.category}, Paid By: ${e.paidBy}, Notes: ${e.notes || ''}`).join('\n') || 'None'}
  `;

  let userIntentDescription = "";
  if (activeSession && activeSession.pendingExpense) {
    const pending = activeSession.pendingExpense;
    const pendingPayerName = usersList.find(u => u.id === pending.paidBy)?.name || 'Unknown';
    userIntentDescription += `PENDING SESSION PROPOSAL IN PROGRESS:
We currently have a pending expense proposal in the user's active session waiting for their confirmation:
- Amount: ₹${pending.amount}
- Merchant: "${pending.merchant || 'Unknown'}"
- Category: "${normalizeCategory(pending.category)}"
- Paid By: "${pendingPayerName}"
- Date: "${pending.date || today}"
- Notes: "${pending.notes || ''}"
The user's new message is likely responding to this proposal by confirming it (possibly with edits/corrections, e.g. "add note as X and confirm it", "change amount to Y and confirm", "yes confirm it") or cancelling it ("actually discard it", "no cancel").\n\n`;
  }

  if (text) {
    userIntentDescription += `User text input: "${text}"\n`;
  }
  if (ocrData) {
    userIntentDescription += `Extracted receipt details from OCR:\n`;
    userIntentDescription += `- Amount: ₹${ocrData.amount}\n`;
    userIntentDescription += `- Merchant: "${ocrData.merchant}"\n`;
    userIntentDescription += `- Date: "${ocrData.date}"\n`;
    userIntentDescription += `- Notes: "${ocrData.notes || ''}"\n`;
  }

  const aiPrompt = `
    You are "FamBudget Bot", an automated Indian WhatsApp bot assistant for private family budget Logging & Insights.
    Current Date Today: ${today}
    
    FAMILY GROUPS:
    ${groupsString}
    
    FAMILY MEMBERS AVAILABLE:
    ${usersString}
    
    STANDARD CATEGORIES:
    ${categoriesList.join(', ')}
    
    Current User Sender: User ${senderName} (belongs to group ${userGroup?.name || 'Unknown'}).
    
    CURRENT FINANCIAL STATISTICS CONTEXT:
    ${statsString}
    
    Your goal:
    1. Interpret the user input:
       ${userIntentDescription}
    2. Determine the ACTION (must be exactly one of: "log_expense", "cancel_expense", "ask_question", "need_clarification"):
       - If they want to log/save an expense or confirm a proposal: action = "log_expense".
       - If they want to discard/cancel the proposal: action = "cancel_expense".
       - If they are asking a question about statistics, balances, spending, or savings: action = "ask_question".
       - If crucial details (like amount) are missing: action = "need_clarification".
    3. If action is "log_expense":
       - Merge any corrections/details from the user input with the pending session proposal (if one exists).
       - Extract: amount (number), merchant, date (YYYY-MM-DD or today), category (map to standard categories: ${categoriesList.join(', ')}), notes.
       - Identify if a specific family member paid (e.g., "Naveen paid 300"). If explicitly mentioned, output their name in "paidByName". Otherwise leave blank.
       - Assign a "confidence" score (integer between 0 and 100, e.g. 95).
    4. If action is "cancel_expense":
       - Return a reply indicating that the proposal has been cancelled.
    5. If action is "ask_question":
       - Formulate a detailed financial reply based ONLY on the CURRENT FINANCIAL STATISTICS CONTEXT. Use standard WhatsApp formatting (*bold*, bullet points).
    6. Return a valid JSON object matching the required schema.
  `;

  const messages = [
    {
      role: 'system',
      content: 'You are FamBudget Bot. You must return a valid JSON object with keys: "action" (must be "log_expense", "cancel_expense", "ask_question", or "need_clarification"), "reply" (string), "expenseProposed" (object with amount, category, date, merchant, notes, paidByName), and "confidence" (number 0-100). Do not include markdown fences.'
    },
    {
      role: 'user',
      content: aiPrompt
    }
  ];

  const responseText = await callGroqChat(messages, true);
  try {
    const cleaned = responseText.replace(/```json/i, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);

    // Normalize action name for consistency
    let action = (result.action || '').toString().toLowerCase().trim();
    if (['log_expense', 'addexpense', 'add_expense', 'logexpense', 'record_expense', 'save_expense'].includes(action)) {
      action = 'log_expense';
    } else if (['cancel_expense', 'cancelexpense', 'cancel', 'discard', 'reject'].includes(action)) {
      action = 'cancel_expense';
    } else if (['ask_question', 'askquestion', 'question', 'query', 'insights'].includes(action)) {
      action = 'ask_question';
    } else if (['need_clarification', 'clarify', 'needclarification'].includes(action)) {
      action = 'need_clarification';
    }
    result.action = action;

    // Normalize confidence: if between 0 and 1 (like 0.95), convert to percentage (95)
    if (typeof result.confidence === 'number' && result.confidence <= 1 && result.confidence > 0) {
      result.confidence = Math.round(result.confidence * 100);
    } else if (typeof result.confidence !== 'number') {
      result.confidence = 95;
    }

    return result;
  } catch (err: any) {
    console.error(`[${traceId || 'ParseAI'}] Failed to parse Groq response: "${responseText}"`, err);
    throw new Error(`Failed to parse Groq response as JSON: ${err.message}`);
  }
}

// WhatsApp Real Webhook Helpers
async function downloadWhatsAppMedia(mediaId: string): Promise<string> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');

  console.log(`[WhatsApp Media] Fetching media metadata from Meta Graph API: mediaId=${mediaId}...`);
  const mediaUrlRes = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!mediaUrlRes.ok) {
    const err = await mediaUrlRes.text();
    throw new Error(`Failed to fetch media metadata from Meta (status ${mediaUrlRes.status}): ${err}`);
  }
  const mediaData = await mediaUrlRes.json();
  const fileUrl = mediaData.url;
  console.log(`[WhatsApp Media] Media metadata received: mimeType=${mediaData.mime_type}, size=${mediaData.file_size} bytes`);

  const fileRes = await fetch(fileUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!fileRes.ok) {
    const err = await fileRes.text();
    throw new Error(`Failed to download media file from Meta (status ${fileRes.status}): ${err}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`[WhatsApp Media] ✅ Successfully downloaded image (${(buffer.length / 1024).toFixed(1)} KB)`);
  return `data:${mediaData.mime_type};base64,${buffer.toString('base64')}`;
}

async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.warn(`[WhatsApp Outbound] ⚠️ Cannot send message to ${to}: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing! (token=${!!token}, phoneNumberId=${!!phoneNumberId})`);
    return;
  }

  console.log(`[WhatsApp Outbound] Dispatching message to ${to} via phoneId=${phoneNumberId}...`);
  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[WhatsApp Outbound] ❌ Meta API error (status ${res.status}) sending to ${to}:`, errText);
  } else {
    const data: any = await res.json().catch(() => ({}));
    console.log(`[WhatsApp Outbound] ✅ Message successfully sent to ${to}! Message ID: ${data?.messages?.[0]?.id || 'delivered'}`);
  }
}

async function sendWhatsAppInteractiveButtons(to: string, bodyText: string, buttons: { id: string; title: string }[]): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.warn(`[WhatsApp Outbound] ⚠️ Cannot send interactive buttons to ${to}: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing!`);
    return;
  }

  // Formatting constraints: up to 3 buttons, title max 20 chars
  const actionButtons = buttons.slice(0, 3).map((btn) => ({
    type: 'reply',
    reply: {
      id: btn.id,
      title: btn.title.slice(0, 20)
    }
  }));

  console.log(`[WhatsApp Outbound] Dispatching interactive buttons to ${to} (${actionButtons.length} buttons)...`);
  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: bodyText
      },
      action: {
        buttons: actionButtons
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[WhatsApp Outbound] ❌ Meta API error (status ${res.status}) sending buttons to ${to}:`, errText);
  } else {
    const data: any = await res.json().catch(() => ({}));
    console.log(`[WhatsApp Outbound] ✅ Interactive buttons successfully sent to ${to}! Message ID: ${data?.messages?.[0]?.id || 'delivered'}`);
  }
}

async function markMessageAsRead(messageId: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        })
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[WhatsApp Read Receipt] API returned status ${res.status}:`, errText);
    } else {
      console.log(`[WhatsApp Read Receipt] ✅ Message ${messageId} marked as read.`);
    }
  } catch (err: any) {
    console.error(`[WhatsApp Read Receipt] Failed to send:`, err.message);
  }
}

// Unified Webhook and Simulator incoming message flow processor
async function handleIncomingMessageFlow(
  text: string | undefined,
  base64Image: string | undefined,
  user: any,
  phoneIdentifier: string,
  isSimulator: boolean,
  traceId?: string
): Promise<string | { text: string; buttons?: { id: string; title: string }[] }> {
  // 1. Check if there is an active confirmation session
  const session = await WhatsAppSessionModel.findOne({ phoneNumber: phoneIdentifier });

  // Programmatic TTL session expiry check (24 hours)
  let activeSession = session;
  if (activeSession) {
    const isExpired = activeSession.expiresAt && new Date() > new Date(activeSession.expiresAt);
    if (isExpired) {
      if (traceId) console.log(`[${traceId}] Session expired for ${phoneIdentifier}. Deleting session.`);
      await WhatsAppSessionModel.deleteOne({ phoneNumber: phoneIdentifier });
      activeSession = null;
    }
  }

  // 2. Handle confirmation keyword (yes, yup, ok, etc.)
  if (activeSession && text && /^(yes|yeah|yup|y|confirm|ok|okay|save|correct|agree|indeed)/i.test(text.trim())) {
    const exp = activeSession.pendingExpense;
    if (exp) {
      const newExpense = await ExpenseModel.create({
        id: `exp-${Date.now()}`,
        amount: exp.amount,
        category: normalizeCategory(exp.category),
        paidBy: exp.paidBy,
        groupId: exp.groupId,
        date: exp.date,
        notes: exp.notes,
        merchant: exp.merchant,
        originalImage: exp.originalImage,
        createdAt: new Date().toISOString()
      });

      await WhatsAppSessionModel.deleteOne({ phoneNumber: phoneIdentifier });

      // Look up spender details
      const spender = user.id === exp.paidBy ? user : (await UserModel.findOne({ id: exp.paidBy })) || user;

      if (traceId) console.log(`[${traceId}] Expense Confirmed and Logged: ${newExpense.id}`);
      return `✅ *Expense Confirmed and Logged!* \n\n💰 *Amount:* ₹${exp.amount}\n🏢 *Merchant:* ${exp.merchant}\n🏷️ *Category:* ${exp.category}\n👤 *Paid By:* ${spender.name}\n📅 *Date:* ${exp.date}\n📝 *Notes:* ${exp.notes || 'None'}\n\nFamily ledger updated successfully! 🚀`;
    }
  }

  // 3. Handle cancel keyword (no, nope, cancel, exit, etc.)
  if (activeSession && text && /^(no|nope|cancel|stop|reject|incorrect|wrong|exit)/i.test(text.trim())) {
    await WhatsAppSessionModel.deleteOne({ phoneNumber: phoneIdentifier });
    if (traceId) console.log(`[${traceId}] Confirmation cancelled by user.`);
    return `❌ *Confirmation Cancelled!* \n\nThe pending expense proposal has been discarded. Feel free to log a new expense! 🤖`;
  }

  // 4. Check for programmatic commands to save AI costs (e.g. summary, compare, help, search, categories)
  if (text && !base64Image) {
    const programmaticReply = await handleProgrammaticCommand(text);
    if (programmaticReply) {
      if (traceId) console.log(`[${traceId}] Intercepted programmatic command: "${text.trim()}"`);
      return programmaticReply;
    }
  }

  // 5. Pre-parse lazy messages for cost control and speed (Merchant Memory)
  let amount: number | null = null;
  let merchant: string | null = null;
  let matchedCategory: string | null = null;

  if (text && !base64Image) {
    const lazyMatch = parseLazyMessage(text);
    if (lazyMatch) {
      amount = lazyMatch.amount;
      merchant = lazyMatch.merchant;

      // Look up in database to see if we have merchant memory
      const matchedExpense = await ExpenseModel.findOne({
        merchant: { $regex: new RegExp(`^${merchant.trim()}$`, 'i') }
      }).sort({ createdAt: -1 });

      if (matchedExpense) {
        matchedCategory = normalizeCategory(matchedExpense.category);
      }
    }
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // 6. If we matched a merchant in memory, auto-save directly!
  if (amount !== null && merchant !== null && matchedCategory !== null) {
    // Check for duplicate logged within 10 minutes (by same user)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const duplicate = await ExpenseModel.findOne({
      amount: amount,
      merchant: { $regex: new RegExp(`^${merchant.trim()}$`, 'i') },
      paidBy: user.id,
      createdAt: { $gte: tenMinutesAgo }
    });

    if (duplicate) {
      // Save pending session (expires in 24 hours)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await WhatsAppSessionModel.updateOne(
        { phoneNumber: phoneIdentifier },
        {
          phoneNumber: phoneIdentifier,
          pendingExpense: {
            amount: amount,
            category: matchedCategory,
            paidBy: user.id,
            groupId: user.groupId,
            date: todayStr,
            notes: 'Logged via merchant memory',
            merchant: merchant
          },
          updatedAt: new Date().toISOString(),
          expiresAt
        },
        { upsert: true }
      );

      if (traceId) console.log(`[${traceId}] Possible Duplicate Detected (Merchant Memory): ₹${amount} at ${merchant}`);
      return `⚠️ *Possible Duplicate Detected!* \n\nIt looks like an expense of *₹${amount}* at *${merchant}* was already logged in the last 10 minutes.\n\nDo you want to log it again anyway? Reply *confirm* / *yes* to save, or *cancel* to skip.`;
    }

    // Save directly!
    const newExpense = await ExpenseModel.create({
      id: `exp-${Date.now()}`,
      amount: amount,
      category: matchedCategory,
      paidBy: user.id,
      groupId: user.groupId,
      date: todayStr,
      notes: 'Logged via merchant memory',
      merchant: merchant,
      createdAt: new Date().toISOString()
    });

    await WhatsAppSessionModel.deleteOne({ phoneNumber: phoneIdentifier });

    if (traceId) console.log(`[${traceId}] Expense logged via Merchant Memory: ${newExpense.id}`);
    return `✅ *Expense Logged!* (Auto-matched Category: *${matchedCategory}*)\n\n💰 *Amount:* ₹${amount}\n🏢 *Merchant:* ${merchant}\n📅 *Date:* ${todayStr}\n👤 *Paid By:* ${user.name}\n\nLive dashboards updated! 🚀`;
  }

  // 7. Otherwise, fall back to Gemini AI parsing (Split OCR and Parser)
  let ocrData = null;
  if (base64Image) {
    if (traceId) console.log(`[${traceId}] OCR Started`);
    ocrData = await runOcrOnReceipt(base64Image);
    if (traceId) console.log(`[${traceId}] OCR Finished: ${JSON.stringify(ocrData)}`);
  }

  if (traceId) console.log(`[${traceId}] Sending to Expense Parser Agent`);
  const parsedResult = await parseExpenseWithAi(text, ocrData, user, activeSession, traceId);
  if (traceId) console.log(`[${traceId}] AI Parser output action: ${parsedResult.action}, confidence: ${parsedResult.confidence}`);

  if (parsedResult.action === 'log_expense' && parsedResult.expenseProposed) {
    const exp = parsedResult.expenseProposed;

    // Payer determination (never trust AI with raw IDs)
    let paidBy = user.id;
    let groupId = user.groupId;
    const usersList = await UserModel.find();
    if (exp.paidByName) {
      const matchedUser = usersList.find(u => u.name.toLowerCase() === exp.paidByName.toLowerCase());
      if (matchedUser) {
        paidBy = matchedUser.id;
        groupId = matchedUser.groupId;
      }
    }

    // Check for duplicate logged within 10 minutes (by same user)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const duplicate = await ExpenseModel.findOne({
      amount: Number(exp.amount),
      merchant: { $regex: new RegExp(`^${exp.merchant.trim()}$`, 'i') },
      paidBy: paidBy,
      createdAt: { $gte: tenMinutesAgo }
    });

    if (duplicate) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await WhatsAppSessionModel.updateOne(
        { phoneNumber: phoneIdentifier },
        {
          phoneNumber: phoneIdentifier,
          pendingExpense: {
            amount: Number(exp.amount),
            category: normalizeCategory(exp.category),
            paidBy,
            groupId,
            date: exp.date || todayStr,
            notes: exp.notes || '',
            merchant: exp.merchant,
            originalImage: base64Image
          },
          updatedAt: new Date().toISOString(),
          expiresAt
        },
        { upsert: true }
      );

      if (traceId) console.log(`[${traceId}] Possible Duplicate Detected (AI Parse): ₹${exp.amount} at ${exp.merchant}`);
      return {
        text: `⚠️ *Possible Duplicate Detected!* \n\nIt looks like an expense of *₹${exp.amount}* at *${exp.merchant}* was already logged in the last 10 minutes.\n\nDo you want to log it again anyway?`,
        buttons: [
          { id: 'confirm_yes', title: 'Confirm & Save' },
          { id: 'confirm_no', title: 'Cancel' }
        ]
      };
    }

    const hasImage = !!base64Image;
    const hasNote = exp.notes && exp.notes.trim() !== '';
    const shouldAutoLog = parsedResult.confidence >= 90 && (!hasImage || hasNote);

    // Auto-save if confidence is high (confidence >= 90) and no duplicate and we don't need to ask for notes
    if (shouldAutoLog) {
      const newExpense = await ExpenseModel.create({
        id: `exp-${Date.now()}`,
        amount: Number(exp.amount),
        category: normalizeCategory(exp.category),
        paidBy,
        groupId,
        date: exp.date || todayStr,
        notes: exp.notes || '',
        merchant: exp.merchant,
        originalImage: base64Image,
        createdAt: new Date().toISOString()
      });

      await WhatsAppSessionModel.deleteOne({ phoneNumber: phoneIdentifier });

      const payer = user.id === paidBy ? user : (await UserModel.findOne({ id: paidBy })) || user;
      if (traceId) console.log(`[${traceId}] Expense auto-logged (confidence ${parsedResult.confidence}%): ${newExpense.id}`);
      return `✅ *Expense Logged!* \n\n💰 *Amount:* ₹${exp.amount}\n🏢 *Merchant:* ${exp.merchant}\n🏷️ *Category:* ${normalizeCategory(exp.category)}\n👤 *Paid By:* ${payer.name}\n📅 *Date:* ${exp.date || todayStr}\n📝 *Notes:* ${exp.notes || 'None'}\n\nLive dashboards updated! 🚀`;
    } else {
      // Save pending session for confirmation
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await WhatsAppSessionModel.updateOne(
        { phoneNumber: phoneIdentifier },
        {
          phoneNumber: phoneIdentifier,
          pendingExpense: {
            amount: Number(exp.amount),
            category: normalizeCategory(exp.category),
            paidBy,
            groupId,
            date: exp.date || todayStr,
            notes: exp.notes || '',
            merchant: exp.merchant,
            originalImage: base64Image
          },
          updatedAt: new Date().toISOString(),
          expiresAt
        },
        { upsert: true }
      );

      if (traceId) console.log(`[${traceId}] Session saved for manual confirmation (confidence ${parsedResult.confidence}%)`);
      const payer = user.id === paidBy ? user : (await UserModel.findOne({ id: paidBy })) || user;

      // If it is a screenshot and no note was found, ask the user if they want to add a note
      if (hasImage && !hasNote) {
        return {
          text: `🤔 *I detected a screenshot expense proposal:* \n\n💰 *Amount:* ₹${exp.amount}\n🏢 *Merchant:* ${exp.merchant || 'None'}\n🏷️ *Category:* ${normalizeCategory(exp.category)}\n👤 *Paid By:* ${payer.name}\n📅 *Date:* ${exp.date || todayStr}\n\n*No note was found in the screenshot.* Do you want to add any notes before logging this? Reply with your note text, or click *Confirm & Save* below to log without notes. 🤖`,
          buttons: [
            { id: 'confirm_yes', title: 'Confirm & Save' },
            { id: 'confirm_no', title: 'Cancel' }
          ]
        };
      }

      return {
        text: `🤔 *Please confirm this expense proposal:* \n\n💰 *Amount:* ₹${exp.amount}\n🏢 *Merchant:* ${exp.merchant || 'None'}\n🏷️ *Category:* ${normalizeCategory(exp.category)}\n👤 *Paid By:* ${payer.name}\n📅 *Date:* ${exp.date || todayStr}\n📝 *Notes:* ${exp.notes || 'None'}`,
        buttons: [
          { id: 'confirm_yes', title: 'Confirm & Save' },
          { id: 'confirm_no', title: 'Cancel' }
        ]
      };
    }
  }

  // If action is ask_question, return the reply directly
  if (parsedResult.action === 'ask_question') {
    return parsedResult.reply;
  }

  // If action is cancel_expense, clear the active session and return the reply
  if (parsedResult.action === 'cancel_expense') {
    await WhatsAppSessionModel.deleteOne({ phoneNumber: phoneIdentifier });
    if (traceId) console.log(`[${traceId}] Confirmation cancelled by user via AI.`);
    return parsedResult.reply || `❌ *Confirmation Cancelled!* \n\nThe pending expense proposal has been discarded.`;
  }

  // Fallback for need_clarification
  if (parsedResult.action === 'need_clarification' && parsedResult.expenseProposed && parsedResult.expenseProposed.amount) {
    const exp = parsedResult.expenseProposed;
    let paidBy = user.id;
    let groupId = user.groupId;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await WhatsAppSessionModel.updateOne(
      { phoneNumber: phoneIdentifier },
      {
        phoneNumber: phoneIdentifier,
        pendingExpense: {
          amount: Number(exp.amount),
          category: normalizeCategory(exp.category),
          paidBy,
          groupId,
          date: exp.date || todayStr,
          notes: exp.notes || '',
          merchant: exp.merchant || 'Unknown',
          originalImage: base64Image
        },
        updatedAt: new Date().toISOString(),
        expiresAt
      },
      { upsert: true }
    );
  }

  return parsedResult.reply;
}

// Simulated WhatsApp bot chat route
app.post('/api/whatsapp/message', authenticateJWT, async (req: any, res) => {
  const { text, base64Image, senderName } = req.body;
  if (!text && !base64Image) {
    return res.status(400).json({ error: 'Empty prompt message payload' });
  }

  try {
    const user = await UserModel.findOne({ name: { $regex: new RegExp(`^${senderName || 'Rahul'}$`, 'i') } }) || await UserModel.findOne();
    if (!user) return res.status(400).json({ error: 'User context is missing in database' });

    // Log user message
    await WhatsAppChatModel.create({
      id: `usr-msg-${Date.now()}`,
      sender: 'user',
      senderName: user.name,
      text: text || 'Uploaded an image 📁',
      timestamp: new Date().toISOString(),
      image: base64Image
    });

    const phoneIdentifier = `simulator-${user.id}`;
    const traceId = `sim-msg-${Date.now()}`;
    console.log(`[${traceId}] Received message from simulator`);
    const replyResult = await handleIncomingMessageFlow(text, base64Image, user, phoneIdentifier, true, traceId);
    const replyText = typeof replyResult === 'string' ? replyResult : replyResult.text;

    await WhatsAppChatModel.create({
      id: `bot-msg-${Date.now()}`,
      sender: 'bot',
      text: replyText,
      timestamp: new Date().toISOString()
    });

    const state = await getDBState(req.user.id);
    res.json(state);

  } catch (error: any) {
    console.error('WhatsApp Bot AI Simulator Error:', error);
    await WhatsAppChatModel.create({
      id: `bot-msg-err-${Date.now()}`,
      sender: 'bot',
      text: `Sorry 😔, I ran into an error processing that. Details: ${error.message}`,
      timestamp: new Date().toISOString()
    });
    const state = await getDBState(req.user.id);
    res.json(state);
  }
});

// Real WhatsApp Webhook Verification Endpoint
app.get('/api/whatsapp/webhook', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'verify_token_default';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('\n==============================================================');
  console.log('🔑 [WHATSAPP WEBHOOK GET VERIFICATION]');
  console.log(`   hub.mode: "${mode}"`);
  console.log(`   hub.verify_token received: "${token}"`);
  console.log(`   expected WHATSAPP_VERIFY_TOKEN: "${verifyToken}"`);
  console.log(`   hub.challenge: "${challenge}"`);

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('   Verification Result: ✅ MATCH! Challenge returned.');
    console.log('==============================================================\n');
    return res.status(200).send(challenge);
  } else {
    console.warn(`   Verification Result: ❌ MISMATCH! Expected "${verifyToken}" but got "${token}".`);
    console.log('==============================================================\n');
    return res.sendStatus(403);
  }
});

// Background processor helper for webhook messages
async function processWebhookMessageAsync(message: any, traceId: string): Promise<void> {
  const from = message?.from;
  try {
    if (!from) {
      console.error(`[${traceId}] ❌ Missing message.from in webhook payload:`, message);
      return;
    }
    const messageId = message.id;
    let text = message.text?.body;
    const type = message.type;
    let base64Image: string | undefined;

    if (type === 'interactive') {
      const btnReply = message.interactive?.button_reply;
      if (btnReply) {
        text = btnReply.title; // Treat button reply title as message text
        console.log(`[${traceId}] Interactive button click received: id=${btnReply.id}, title="${btnReply.title}"`);
      }
    }

    if (type !== 'text' && type !== 'image' && type !== 'interactive') {
      console.log(`[${traceId}] Ignoring unsupported webhook message type: ${type}`);
      return;
    }

    console.log(`\n--------------------------------------------------------------`);
    console.log(`[${traceId}] 🚀 WHATSAPP PROCESSING PIPELINE STARTED`);
    console.log(`   Sender Phone: "${from}" | Message Type: "${type}" | Message ID: "${messageId}"`);
    console.log(`   Credentials Check:`);
    console.log(`     - WHATSAPP_ACCESS_TOKEN: ${process.env.WHATSAPP_ACCESS_TOKEN ? '✅ Configured (' + process.env.WHATSAPP_ACCESS_TOKEN.substring(0, 10) + '...)' : '❌ MISSING'}`);
    console.log(`     - WHATSAPP_PHONE_NUMBER_ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID ? '✅ Configured (' + process.env.WHATSAPP_PHONE_NUMBER_ID + ')' : '❌ MISSING'}`);
    console.log(`     - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Configured (' + process.env.GEMINI_API_KEY.substring(0, 10) + '...)' : '❌ MISSING'}`);
    console.log(`     - GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Configured (' + process.env.GROQ_API_KEY.substring(0, 10) + '...)' : '❌ MISSING'}`);

    // Mark message as read (turns blue ticks on)
    if (messageId) {
      console.log(`[${traceId}] Marking message ${messageId} as read (blue ticks)...`);
      await markMessageAsRead(messageId);
    }

    // Find linked user profile by phone number (robust matching with/without country code)
    const cleanFrom = from.replace(/\D/g, '');
    const last10 = cleanFrom.slice(-10);
    console.log(`[${traceId}] Looking up user with phone: "${cleanFrom}" (last10: "${last10}")...`);

    const user = await UserModel.findOne({
      $or: [
        { whatsappNumber: cleanFrom },
        { whatsappNumber: last10 },
        { whatsappNumber: '91' + last10 },
        { whatsappNumber: { $regex: new RegExp(last10 + '$') } }
      ]
    });

    if (!user) {
      const allUsers = await UserModel.find({}, { name: 1, whatsappNumber: 1 });
      const regList = allUsers.map(u => `${u.name} (${u.whatsappNumber || 'none'})`).join(', ');
      console.warn(`[${traceId}] ⚠️ NO LINKED USER FOUND for phone number: "${cleanFrom}"`);
      console.warn(`   Users registered in MongoDB: [${regList}]`);
      console.log(`[${traceId}] Dispatching Welcome/Unlinked notification to ${from}...`);
      await sendWhatsAppMessage(
        from,
        `⚠️ *Welcome to FamilyFunds!* \n\nYour WhatsApp number is not linked to any member profile in our system. \n\n👉 Please log in to the FamilyFunds app, navigate to the *Family & Groups* settings, and link this phone number (*${from}*) to your profile to enable automatic expense logging! 🚀`
      );
      return;
    }

    console.log(`[${traceId}] ✅ User Matched: "${user.name}" (${user.id}), Group: ${user.groupId}`);

    // Log the user message to simulator chat history
    await WhatsAppChatModel.create({
      id: `real-usr-msg-${Date.now()}`,
      sender: 'user',
      senderName: user.name,
      text: text || `Sent an attachment [${type}] 📁`,
      timestamp: new Date().toISOString()
    });

    // Download image if type is image
    if (type === 'image' && message.image?.id) {
      console.log(`[${traceId}] 🖼️ Image receipt detected. Media ID: ${message.image.id}`);
      try {
        base64Image = await downloadWhatsAppMedia(message.image.id);
        console.log(`[${traceId}] ✅ Successfully downloaded receipt image from Meta.`);
      } catch (err: any) {
        console.error(`[${traceId}] ❌ Image download failure:`, err.message || err);
        await sendWhatsAppMessage(from, '❌ Failed to process the uploaded image receipt. Please try sending a plain text description (e.g. "DMart 1500").');
        return;
      }
    }

    // Run unified message flow processor
    console.log(`[${traceId}] 🧠 Running message flow processor (OCR & Intent Parser)...`);
    const replyResult = await handleIncomingMessageFlow(text, base64Image, user, cleanFrom, false, traceId);

    const logText = typeof replyResult === 'string' ? replyResult : replyResult.text;

    // Send reply via WhatsApp
    if (typeof replyResult === 'object' && replyResult.buttons && replyResult.buttons.length > 0) {
      console.log(`[${traceId}] 📤 Sending interactive buttons reply to ${from}...`);
      await sendWhatsAppInteractiveButtons(from, replyResult.text, replyResult.buttons);
    } else {
      console.log(`[${traceId}] 📤 Sending text reply to ${from}...`);
      await sendWhatsAppMessage(from, logText);
    }

    // Log bot reply to simulator history
    await WhatsAppChatModel.create({
      id: `real-bot-msg-${Date.now()}`,
      sender: 'bot',
      text: logText,
      timestamp: new Date().toISOString()
    });
    console.log(`[${traceId}] 🏁 WhatsApp pipeline completed successfully.`);
    console.log(`--------------------------------------------------------------\n`);
  } catch (err: any) {
    console.error(`[${traceId}] ❌ PROCESSOR CRASH:`, err);
    if (from) {
      try {
        let friendlyError = "⚠️ *FamBudget Error* \n\nAn unexpected error occurred while processing your message. Please try again later.";
        const errMsg = err.message || (typeof err === 'string' ? err : '');
        if (errMsg.includes("prepayment credits are depleted") || errMsg.includes("RESOURCE_EXHAUSTED")) {
          friendlyError = "⚠️ *FamBudget Billing Error* \n\nYour Gemini API prepayment credits are depleted. Please check your project billing or add credits in Google AI Studio:\n👉 https://aistudio.google.com/app/billing";
        } else if (errMsg) {
          friendlyError = `⚠️ *FamBudget Error* \n\nFailed to process message: ${errMsg}`;
        }
        await sendWhatsAppMessage(from, friendlyError);
      } catch (sendErr) {
        console.error(`[${traceId}] Failed to send error notification back to user via WhatsApp:`, sendErr);
      }
    }
  }
}

// Real WhatsApp Webhook Event Notifications Receiver Endpoint
app.post('/api/whatsapp/webhook', async (req, res) => {
  const { body } = req;
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour12: false });
  console.log(`\n==============================================================`);
  console.log(`📲 [WHATSAPP WEBHOOK POST EVENT] ${timeStr}`);
  console.log(`   Object: ${body?.object}`);

  if (body?.object !== 'whatsapp_business_account') {
    console.log(`   ⚠️ Bypassing non-whatsapp_business_account object: ${body?.object}`);
    console.log(`==============================================================\n`);
    return res.status(200).send('EVENT_RECEIVED');
  }

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const statuses = value?.statuses;
    const messages = value?.messages;

    if (statuses && statuses.length > 0) {
      const st = statuses[0];
      console.log(`   ℹ️ Meta Delivery/Read Receipt: msgId=${st.id}, status="${st.status}", recipient=${st.recipient_id}`);
    }

    const message = messages?.[0];
    if (!message) {
      console.log('   ℹ️ No incoming user message in this event (status receipt event).');
      console.log(`==============================================================\n`);
      return res.status(200).send('EVENT_RECEIVED');
    }

    const messageId = message?.id;
    console.log(`   ✉️ Incoming Message: from="${message.from}", type="${message.type}", id="${messageId}"`);
    if (message.text?.body) console.log(`   💬 Text Body: "${message.text.body}"`);
    if (message.image?.id) console.log(`   🖼️ Image Attachment: mediaId="${message.image.id}"`);
    console.log(`==============================================================\n`);

    if (messageId) {
      const existing = await ProcessedMessageModel.findOne({ messageId });
      if (existing) {
        console.log(`[Webhook] Duplicate message ignored: ${messageId}`);
        return res.status(200).send('EVENT_RECEIVED');
      }

      await ProcessedMessageModel.create({
        messageId,
        createdAt: new Date()
      });
    }

    const traceId = `${messageId || 'msg'}-${Date.now()}`;
    console.log(`[${traceId}] Processing message pipeline...`);

    // Process synchronously to ensure serverless containers don't freeze before completion
    await processWebhookMessageAsync(message, traceId);

    // Return 200 OK
    return res.status(200).send('EVENT_RECEIVED');
  } catch (error: any) {
    console.error('[WhatsApp Webhook] ❌ Fatal error processing event:', error);
    res.status(500).send('INTERNAL_SERVER_ERROR');
  }
});

// Clear WhatsApp Simulator chat logs
app.post('/api/whatsapp/clear', authenticateJWT, async (req: any, res) => {
  try {
    await WhatsAppChatModel.deleteMany({});
    await WhatsAppChatModel.create({
      id: 'chat-1',
      sender: 'bot',
      text: 'Hello Sharma Family! I am FamBudget, your automated Expense Agent. 🤖📱\n\nSend me text like "Paid ₹850 for vegetables" or drop any mobile transaction screenshot (GPay, PhonePe, Paytm, etc.) right here to instantly log expenses!',
      timestamp: new Date().toISOString()
    });

    const state = await getDBState(req.user.id);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- GEMINI AI FINANCIAL ADVISOR ENDPOINTS -------------------

app.post('/api/ai/advisor', authenticateJWT, async (req: any, res) => {
  const { text } = req.body;
  if (!text) {
    console.warn('[Advisor Diagnostic] ❌ Empty advisor prompt message payload.');
    return res.status(400).json({ error: 'Empty advisor prompt message payload' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'MOCK_KEY_IF_ABSENT' || apiKey.trim() === '') {
    console.warn('[Advisor Diagnostic] ⚠️ GROQ_API_KEY is missing or unconfigured.');
    return res.status(400).json({
      error: 'GROQ_API_KEY_MISSING',
      message: 'GROQ_API_KEY is not configured in your environment or .env.local. Please add a valid API key to .env.local and restart the server to use the AI Financial Advisor.'
    });
  }

  const advisorStart = Date.now();
  try {
    const userId = req.user.id;
    const user = await UserModel.findOne({ id: userId });
    if (!user) {
      console.warn(`[Advisor Diagnostic] ❌ User context missing in database: userId=${userId}`);
      return res.status(400).json({ error: 'User context is missing in database' });
    }

    console.log(`[Advisor Diagnostic] User "${user.name}" (${user.id}) prompted: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

    // 1. Fetch current database state
    const dbState = await getDBState(userId);

    // 2. Prepare aggregated and summarized financial context for Groq
    const groupsString = dbState.groups.map(g => `- Group: ${g.name} (ID: ${g.id})`).join('\n');
    const usersString = dbState.users.map(u => `- Member: ${u.name} (Group: ${u.groupId}, Role: ${u.role})`).join('\n');

    // Map user IDs and Group IDs to names
    const userMap: { [id: string]: string } = {};
    dbState.users.forEach(u => {
      userMap[u.id] = u.name;
    });
    const groupMap: { [id: string]: string } = {};
    dbState.groups.forEach(g => {
      groupMap[g.id] = g.name;
    });

    let totalSpend = 0;
    const categoryTotals: { [cat: string]: number } = {};
    const groupTotals: { [grp: string]: number } = {};
    const memberTotals: { [mem: string]: number } = {};

    dbState.expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      totalSpend += amt;
      const cat = e.category || 'Mislenious';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      const gName = groupMap[e.groupId] || e.groupId;
      groupTotals[gName] = (groupTotals[gName] || 0) + amt;
      const mName = userMap[e.paidBy] || e.paidBy;
      memberTotals[mName] = (memberTotals[mName] || 0) + amt;
    });

    // Sort expenses newest first and pass recent 25 transactions with context
    const sortedExpenses = [...dbState.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentExpensesString = sortedExpenses.slice(0, 25).map(e => {
      const payer = userMap[e.paidBy] || e.paidBy;
      const grp = groupMap[e.groupId] || e.groupId;
      return `- ${e.date}: ₹${e.amount} (${e.category}) by ${payer} [${grp}] at ${e.merchant}${e.notes ? ` - "${e.notes}"` : ''}`;
    }).join('\n') || 'No expenses logged yet.';

    const categoryBreakdownString = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `- ${cat}: ₹${amt.toLocaleString('en-IN')}`)
      .join('\n') || 'None';

    const groupBreakdownString = Object.entries(groupTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([grp, amt]) => `- ${grp}: ₹${amt.toLocaleString('en-IN')}`)
      .join('\n') || 'None';

    const memberBreakdownString = Object.entries(memberTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([mem, amt]) => `- ${mem}: ₹${amt.toLocaleString('en-IN')}`)
      .join('\n') || 'None';

    const settlementsString = dbState.settlements.map(s => {
      const fromG = groupMap[s.fromGroup] || s.fromGroup;
      const toG = groupMap[s.toGroup] || s.toGroup;
      return `- Date: ${s.date}, Amount: ₹${s.amount}, Status: ${s.status}, From: ${fromG}, To: ${toG}${s.notes ? `, Notes: ${s.notes}` : ''}`;
    }).join('\n') || 'No settlements logged yet.';

    const today = new Date().toISOString().split('T')[0];

    // 3. System instruction text with concise, high-value metrics (well within token limits)
    const systemInstruction = `
You are "Sharma Finance Advisor", a premium, wise, and helpful AI financial consultant for the Sharma family assembly.
Your goal is to analyze the family's expense metrics, groups, users, and settlements, and provide personalized, highly contextual financial insights, saving strategies, group-wise spending breakdowns, and answer any queries.

FINANCIAL CONTEXT:
- Family Name: ${dbState.family?.name || 'Sharma Family Assembly'}
- Total All-Time Spend: ₹${totalSpend.toLocaleString('en-IN')}
- Total Logged Expenses Count: ${dbState.expenses.length}

GROUPS & MEMBERS:
${groupsString}
${usersString}

SPENDING BREAKDOWNS:
- Category Totals:
${categoryBreakdownString}
- Couple/Group Totals:
${groupBreakdownString}
- Member Totals:
${memberBreakdownString}

SETTLEMENTS & DEBTS:
${settlementsString}

RECENT 25 EXPENSES:
${recentExpensesString}

Current Date Today: ${today}
Current User Chatting with you: ${user.name} (Group: ${groupMap[user.groupId] || user.groupId})

CRITICAL READ-ONLY RULES:
1. You are strictly a **READ-ONLY** advisor. You CANNOT add, create, modify, delete, log, or track expenses or settlements.
2. If the user tells you to add, log, or track an expense (e.g., "I spent 600 on coffee", "add petrol 500", "log 1000 for groceries"), you MUST politely explain that you are a read-only advisor and do not have write access to the database.
3. You must instruct the user to add the expense using the proper channels:
   - Use the **Log Expense** / **Add Expense** button in the dashboard or ledger tabs in this web application.
   - Message the **WhatsApp Bot** directly to log expenses using natural language.
4. NEVER hallucinate, pretend, or tell the user that you have added, logged, or saved an expense or settlement.

RULES & STYLE:
1. Be polite, encouraging, professional yet warm, using finance/wealth metaphors when appropriate.
2. Structure your response using markdown. Use tables, bold headers, list bullet points, and highlight metrics (like ₹ amounts) to make it visually premium and readable.
3. Offer action-oriented suggestions based on the provided spending metrics.
4. Refer to family members by their names (e.g., Chetan, Naveen, Sneha, Riyati, Papa, Mummy).
5. Ground your answers ONLY in the provided database context.
6. Keep responses concise and focused on the user's query.
`;

    // 4. Save user message to MongoDB
    await AdvisorChatModel.create({
      id: `adv-usr-msg-${Date.now()}`,
      userId,
      role: 'user',
      text,
      timestamp: new Date().toISOString()
    });

    // 5. Gather chat history for Groq model context (keep last 10 messages to respect TPM token budget)
    const recentMessages = await AdvisorChatModel.find({ userId }).sort({ timestamp: -1 }).limit(10);
    recentMessages.reverse();

    // Format messages for the Groq completions format: [{role: 'system' | 'user' | 'assistant', content: string}]
    const messages = [
      { role: 'system', content: systemInstruction },
      ...recentMessages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text
      }))
    ];

    console.log(`[Advisor Diagnostic] Calling Groq API with context (${messages.length} messages, ${dbState.expenses.length} expenses)...`);
    const replyText = await callGroqChat(messages, false);
    console.log(`[Advisor Diagnostic] ✅ Groq response received (${replyText.length} chars) in ${Date.now() - advisorStart}ms!`);

    // 6. Save model response to MongoDB
    await AdvisorChatModel.create({
      id: `adv-bot-msg-${Date.now()}`,
      userId,
      role: 'model',
      text: replyText,
      timestamp: new Date().toISOString()
    });

    // 7. Return refreshed DB state (which now includes updated advisorChat)
    const updatedState = await getDBState(userId);
    res.json(updatedState);

  } catch (error: any) {
    console.error(`[Advisor Diagnostic] ❌ Advisor Chat Error (${Date.now() - advisorStart}ms):`, error.message || error);
    let message = error.message || 'Unknown server error';
    if (message.includes('API key not valid') || message.includes('API_KEY_INVALID') || message.includes('unauthorized') || message.includes('forbidden')) {
      message = 'The configured GROQ_API_KEY is invalid or unauthorized. Please check your key in your .env.local file.';
    }
    res.status(500).json({ error: 'Failed to run AI Advisor', message });
  }
});

app.post('/api/ai/advisor/clear', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    await AdvisorChatModel.deleteMany({ userId });

    const state = await getDBState(userId);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to clear advisor chat history', message: err.message });
  }
});

// Settlements CRUD
app.post('/api/settlements', authenticateJWT, async (req: any, res) => {
  const { fromGroup, toGroup, amount, notes, billingMonth } = req.body;
  if (!fromGroup || !toGroup || !amount) {
    return res.status(400).json({ error: 'Missing settlement fields' });
  }

  try {
    const currentMonthStr = new Date().toISOString().slice(0, 7); // Default to current month: YYYY-MM
    const newSettlement = await SettlementModel.create({
      id: `set-${Date.now()}`,
      fromGroup,
      toGroup,
      amount: Number(amount),
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      notes: notes || 'Settlement calculated by settlement engine',
      billingMonth: billingMonth || currentMonthStr
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, settlement: newSettlement, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to log settlement', message: err.message });
  }
});

app.put('/api/settlements/:id/settle', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  try {
    await SettlementModel.updateOne({ id }, {
      status: 'settled',
      settledAt: new Date().toISOString()
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to settle', message: err.message });
  }
});

app.delete('/api/settlements/:id', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  try {
    await SettlementModel.deleteOne({ id });
    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete settlement', message: err.message });
  }
});

// ------------------- NOTIFICATIONS & WEB PUSH ROUTES -------------------

// 1. Get VAPID Public Key for client browser subscription
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// 2. Save/Update Push Subscription
app.post('/api/push/subscribe', authenticateJWT, async (req: any, res) => {
  const { subscription, userAgent } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Missing subscription credentials' });
  }

  try {
    const updated = await PushSubscriptionModel.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: req.user.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        createdAt: new Date().toISOString(),
        userAgent: userAgent || req.headers['user-agent'] || ''
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Device registered for push notifications', subscription: updated });
  } catch (err: any) {
    console.error('[Push Subscribe] Error:', err);
    res.status(500).json({ error: 'Failed to save push subscription', message: err.message });
  }
});

// 3. Unsubscribe Device
app.post('/api/push/unsubscribe', authenticateJWT, async (req: any, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  try {
    await PushSubscriptionModel.deleteOne({ endpoint });
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unsubscribe', message: err.message });
  }
});

// 4. Custom Route to Test Cron Push Notification for All Users (Requested by user)
app.all('/api/notifications/test-cron', authenticateJWT, async (req: any, res) => {
  try {
    const title = req.body?.title || req.query?.title || '📅 Mid-Month Ledger Check-in (Test)';
    const message = req.body?.message || req.query?.message || 'Friendly ledger check-in! Don\'t forget to log your receipts and expenditures for the month.';
    const actionUrl = req.body?.actionUrl || '/expenses?action=add';

    const result = await broadcastLedgerReminder(title, message, actionUrl);
    const state = await getDBState(req.user.id);

    res.json({
      success: true,
      message: `Cron push notification broadcast dispatched! Delivered: ${result.deliveredCount}, Failed: ${result.failedCount}, In-App Created: ${result.usersCount}`,
      stats: result,
      state
    });
  } catch (err: any) {
    console.error('[Test Cron] Error broadcasting:', err);
    res.status(500).json({ error: 'Failed to broadcast test cron push notification', message: err.message });
  }
});

// 5. Fetch Notifications
app.get('/api/notifications', authenticateJWT, async (req: any, res) => {
  try {
    const list = await NotificationModel.find({
      $or: [{ userId: req.user.id }, { userId: 'all' }]
    }).sort({ createdAt: -1 }).limit(40).lean();
    res.json({ success: true, notifications: list });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notifications', message: err.message });
  }
});

// 6. Mark Single Notification as Read
app.put('/api/notifications/:id/read', authenticateJWT, async (req: any, res) => {
  try {
    await NotificationModel.updateOne({ id: req.params.id }, { read: true });
    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark notification read', message: err.message });
  }
});

// 7. Mark All Notifications as Read
app.put('/api/notifications/read-all', authenticateJWT, async (req: any, res) => {
  try {
    await NotificationModel.updateMany(
      { $or: [{ userId: req.user.id }, { userId: 'all' }] },
      { read: true }
    );
    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark all as read', message: err.message });
  }
});

// 8. Clear/Delete Notification
app.delete('/api/notifications/:id', authenticateJWT, async (req: any, res) => {
  try {
    await NotificationModel.deleteOne({ id: req.params.id });
    const state = await getDBState(req.user.id);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete notification', message: err.message });
  }
});

// ------------------- VITE & STATIC HANDLING -------------------
export async function startServer() {
  // Initialize cron schedules for notifications
  initNotificationCronJobs();

  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import so Vite is never loaded in the serverless/production bundle
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started on port http://localhost:${PORT}`);
  });
}

// ------------------- CONNECT TO MONGO HELPER -------------------
export async function connectDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/familyfunds';
  console.log('Connecting to MongoDB at URI:', MONGODB_URI);
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 4000 // 4 seconds timeout
    });
    console.log('MongoDB successfully connected.');
  } catch (err) {
    console.error('Failed to connect to primary MongoDB cluster:', err);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Starting local in-memory fallback database (MongoMemoryServer)...');
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        const fallbackUri = mongoServer.getUri();
        console.log('Connecting to in-memory fallback database at:', fallbackUri);
        await mongoose.connect(fallbackUri);
        console.log('[Fallback] MongoDB connected successfully to local in-memory instance.');
      } catch (fallbackErr) {
        console.error('In-memory fallback database startup failed:', fallbackErr);
        throw err; // throw original connection error if fallback also fails
      }
    } else {
      throw err;
    }
  }
}
