/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
import {
  FamilyModel,
  GroupModel,
  UserModel,
  ExpenseModel,
  SettlementModel,
  WhatsAppChatModel,
  AdvisorChatModel,
  WhatsAppSessionModel,
  ProcessedMessageModel
} from './src/models';

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'family_funds_development_jwt_secret_token_key_123!';

// Set up larger limits for base64 uploads (receipt screenshots)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
  const [family, groups, users, expenses, settlements, whatsappChat, advisorChat] = await Promise.all([
    FamilyModel.findOne(),
    GroupModel.find(),
    UserModel.find({}, { password: 0 }), // Exclude passwords from UI payload
    ExpenseModel.find(),
    SettlementModel.find(),
    WhatsAppChatModel.find(),
    userId ? AdvisorChatModel.find({ userId }).sort({ timestamp: 1 }) : []
  ]);

  return {
    family,
    groups,
    users,
    expenses,
    settlements,
    whatsappChat,
    advisorChat
  };
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
    const groups = await GroupModel.find({}, { _id: 0 });
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
      category: category || 'Miscellaneous',
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
      category: category || expense.category,
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
  if (!base64Image) {
    return res.status(400).json({ error: 'Missing base64Image input for OCR' });
  }

  try {
    const ai = getAiClient();
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
    const prompt = `
      You are an expert financial receipt reader. Please parse this payment screenshot (e.g., GPay, PhonePe, Paytm, BHIM, or static physical bill/receipt) and extract critical data.
      Analyze text, merchant details, payment confirmation, bank accounts numbers or reference IDs, and transaction amount very carefully.
      
      Look for payment confirmation status. Try to guess the appropriate category from standard options:
      - Food
      - Groceries
      - Vegetables
      - Fuel
      - Medical
      - Entertainment
      - Travel
      - Shopping
      - Bills
      - Education
      - Rent
      - Investments
      - Miscellaneous
      
      Return ONLY a raw JSON structure matching these properties:
      {
        "amount": number,
        "merchant": "string",
        "date": "YYYY-MM-DD",
        "category": "suggested category",
        "notes": "short description"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
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

    const parsedData = JSON.parse(response.text || '{}');
    res.json({ success: true, extracted: parsedData });

  } catch (error: any) {
    console.error('OCR Extraction Failure:', error);
    res.status(500).json({ error: 'Failed to run AI OCR', message: error.message });
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

// WhatsApp Bot Chat Integration via AI Simulator
// WhatsApp AI Parsing helper
// Receipt OCR using server-side Gemini
async function runOcrOnReceipt(base64Image: string): Promise<{ amount: number; merchant: string; date: string; notes?: string } | null> {
  try {
    const ai = getAiClient();
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
    const prompt = `
      You are an expert financial receipt reader. Please parse this payment screenshot (e.g., GPay, PhonePe, Paytm, BHIM, or static physical bill/receipt) and extract critical data.
      Analyze text, merchant details, payment confirmation, bank accounts numbers or reference IDs, and transaction amount very carefully.
      
      Look for payment confirmation status. Try to guess the appropriate category from standard options:
      - Food
      - Groceries
      - Vegetables
      - Fuel
      - Medical
      - Entertainment
      - Travel
      - Shopping
      - Bills
      - Education
      - Rent
      - Investments
      - Miscellaneous
      
      Return ONLY a raw JSON structure matching these properties:
      {
        "amount": number,
        "merchant": "string",
        "date": "YYYY-MM-DD",
        "notes": "short description"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
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
    return {
      amount: Number(parsedData.amount) || 0,
      merchant: parsedData.merchant || 'Unknown Merchant',
      date: parsedData.date || new Date().toISOString().split('T')[0],
      notes: parsedData.notes || ''
    };
  } catch (error: any) {
    console.error('[OCR Helper] Receipt OCR Extraction Failure:', error);
    return null;
  }
}

// WhatsApp Bot Chat Integration via AI Simulator
// WhatsApp AI Parsing helper
async function parseExpenseWithAi(
  text?: string,
  ocrData?: { amount: number; merchant: string; date: string; notes?: string } | null,
  senderUser?: any,
  traceId?: string
) {
  if (traceId) {
    console.log(`[${traceId}] parseExpenseWithAi called. text="${text || ''}" ocrData=${JSON.stringify(ocrData)}`);
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const ai = getAiClient();
  
  const [groupsList, usersList, stats] = await Promise.all([
    GroupModel.find(),
    UserModel.find(),
    getFinancialStats()
  ]);

  const groupsString = groupsList.map(g => `Group ID: ${g.id}, Name: ${g.name}`).join('\n');
  const usersString = usersList.map(u => `User Name: ${u.name}, ID: ${u.id}, Group: ${u.groupId}`).join('\n');
  const categoriesList = [
    'Food',
    'Groceries',
    'Vegetables',
    'Fuel',
    'Medical',
    'Entertainment',
    'Travel',
    'Shopping',
    'Bills',
    'Education',
    'Rent',
    'Investments',
    'Miscellaneous'
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
    2. Determine the ACTION:
       - If they want to log an expense (e.g. "Swiggy 500", "Paid ₹300 for medicine", or receipt details were extracted): action = "log_expense".
       - If they are asking a question about statistics, balances, spending, or savings: action = "ask_question".
       - If crucial details (like amount) are missing from their intent to log an expense: action = "need_clarification".
    3. If action is "log_expense":
       - Extract: amount (number), merchant, date (YYYY-MM-DD or today), category (map to standard categories), notes.
       - Identify if a specific family member paid (e.g., "Naveen paid 300"). If explicitly mentioned, output their name in "paidByName". Otherwise leave blank.
       - Assign a "confidence" score (0-100) based on how complete/clear the details are. If OCR data is provided and matches user intent, confidence should be high (e.g., >= 90).
    4. If action is "ask_question":
       - Formulate a detailed financial reply based ONLY on the CURRENT FINANCIAL STATISTICS CONTEXT. Use standard WhatsApp markdown formatting (e.g. *bold*, list points).
    5. Outputs structure in raw JSON matching the required schema.
  `;

  const aiResponse = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{ text: aiPrompt }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        required: ['action', 'reply', 'expenseProposed', 'confidence'],
        properties: {
          action: {
            type: Type.STRING,
            description: 'Action type: log_expense if logging a spend, ask_question if answering stats/balance/spending questions, need_clarification if crucial info is missing.'
          },
          reply: {
            type: Type.STRING,
            description: 'Friendly response to send back to the user on WhatsApp. If action is ask_question, this must contain the detailed financial stats answer formatted with standard WhatsApp markdown (e.g. *bold*, list points).'
          },
          expenseProposed: {
            type: Type.OBJECT,
            description: 'Proposed expense details if action is log_expense or need_clarification.',
            properties: {
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING, description: 'Standard category match: Food, Groceries, Vegetables, Fuel, Medical, Entertainment, Travel, Shopping, Bills, Education, Rent, Investments, Miscellaneous.' },
              date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format.' },
              merchant: { type: Type.STRING },
              notes: { type: Type.STRING },
              paidByName: { type: Type.STRING, description: 'Name of the person who paid if explicitly mentioned in user text (e.g. "Sneha paid"). Otherwise leave empty.' }
            }
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Confidence score from 0 to 100.'
          }
        }
      }
    }
  });

  return JSON.parse(aiResponse.text || '{}');
}

// WhatsApp Real Webhook Helpers
async function downloadWhatsAppMedia(mediaId: string): Promise<string> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');

  const mediaUrlRes = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!mediaUrlRes.ok) {
    const err = await mediaUrlRes.text();
    throw new Error(`Failed to fetch media metadata: ${err}`);
  }
  const mediaData = await mediaUrlRes.json();
  const fileUrl = mediaData.url;

  const fileRes = await fetch(fileUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!fileRes.ok) {
    const err = await fileRes.text();
    throw new Error(`Failed to download media file: ${err}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${mediaData.mime_type};base64,${buffer.toString('base64')}`;
}

async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp] WhatsApp tokens or Phone Number ID not configured.');
    return;
  }

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
    console.error(`[WhatsApp] Failed to send message to ${to}:`, errText);
  } else {
    console.log(`[WhatsApp] Message successfully sent to ${to}`);
  }
}

async function sendTypingIndicator(to: string, messageId: string): Promise<void> {
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
          message_id: messageId,
          typing_indicator: {
            type: 'text'
          }
        })
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[WhatsApp Typing Indicator] API returned non-200 status:`, errText);
    } else {
      console.log(`[WhatsApp Typing Indicator] Sent successfully to ${to}`);
    }
  } catch (err: any) {
    console.error(`[WhatsApp Typing Indicator] Failed to send:`, err.message);
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
): Promise<string> {
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
        category: exp.category || 'Miscellaneous',
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

  // 4. Pre-parse lazy messages for cost control and speed (Merchant Memory)
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
        matchedCategory = matchedExpense.category;
      }
    }
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // 5. If we matched a merchant in memory, auto-save directly!
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

  // 6. Otherwise, fall back to Gemini AI parsing (Split OCR and Parser)
  let ocrData = null;
  if (base64Image) {
    if (traceId) console.log(`[${traceId}] OCR Started`);
    ocrData = await runOcrOnReceipt(base64Image);
    if (traceId) console.log(`[${traceId}] OCR Finished: ${JSON.stringify(ocrData)}`);
  }

  if (traceId) console.log(`[${traceId}] Sending to Expense Parser Agent`);
  const parsedResult = await parseExpenseWithAi(text, ocrData, user, traceId);
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
            category: exp.category || 'Miscellaneous',
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
      return `⚠️ *Possible Duplicate Detected!* \n\nIt looks like an expense of *₹${exp.amount}* at *${exp.merchant}* was already logged in the last 10 minutes.\n\nDo you want to log it again anyway? Reply *confirm* / *yes* to save, or *cancel* to skip.`;
    }

    // Auto-save if confidence is high (confidence >= 90) and no duplicate
    if (parsedResult.confidence >= 90) {
      const newExpense = await ExpenseModel.create({
        id: `exp-${Date.now()}`,
        amount: Number(exp.amount),
        category: exp.category || 'Miscellaneous',
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
      return `✅ *Expense Logged!* \n\n💰 *Amount:* ₹${exp.amount}\n🏢 *Merchant:* ${exp.merchant}\n🏷️ *Category:* ${exp.category}\n👤 *Paid By:* ${payer.name}\n📅 *Date:* ${exp.date || todayStr}\n📝 *Notes:* ${exp.notes || 'None'}\n\nLive dashboards updated! 🚀`;
    } else {
      // Save pending session for confirmation
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await WhatsAppSessionModel.updateOne(
        { phoneNumber: phoneIdentifier },
        {
          phoneNumber: phoneIdentifier,
          pendingExpense: {
            amount: Number(exp.amount),
            category: exp.category || 'Miscellaneous',
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
      return parsedResult.reply;
    }
  }

  // If action is ask_question, return the reply directly
  if (parsedResult.action === 'ask_question') {
    return parsedResult.reply;
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
          category: exp.category || 'Miscellaneous',
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
    const replyText = await handleIncomingMessageFlow(text, base64Image, user, phoneIdentifier, true, traceId);

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

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful.');
    return res.status(200).send(challenge);
  } else {
    console.warn('[WhatsApp Webhook] Verification failed.');
    return res.sendStatus(403);
  }
});

// Background processor helper for webhook messages
async function processWebhookMessageAsync(message: any, traceId: string): Promise<void> {
  try {
    const from = message.from;
    const messageId = message.id;
    const text = message.text?.body;
    const type = message.type;
    let base64Image: string | undefined;

    console.log(`[${traceId}] Background Processing Started: from=${from}, type=${type}`);

    // Count total users in database to inspect connection state
    const totalUsers = await UserModel.countDocuments();
    console.log(`[${traceId}] Total users in DB: ${totalUsers}`);

    // Find linked user profile by phone number (removing non-digits)
    const cleanFrom = from.replace(/\D/g, '');
    console.log(`[${traceId}] Before user lookup with number: ${cleanFrom}`);
    
    const user = await UserModel.findOne({
      whatsappNumber: cleanFrom
    });

    console.log(`[${traceId}] After user lookup. Found user:`, user ? `${user.name} (${user.id})` : 'null');

    if (!user) {
      console.warn(`[${traceId}] NO LINKED USER FOUND for phone number: ${cleanFrom}`);
      console.log(`[${traceId}] Dispatching Welcome/Unlinked warning reply to ${from}`);
      await sendWhatsAppMessage(
        from,
        `⚠️ *Welcome to FamilyFunds!* \n\nYour WhatsApp number is not linked to any member profile in our system. \n\n👉 Please log in to the FamilyFunds app, navigate to the *Family & Groups* settings, and link this phone number (*${from}*) to your profile to enable automatic expense logging! 🚀`
      );
      return;
    }
    
    console.log(`[${traceId}] Found linked user details: ${user.name} (${user.id}), Group: ${user.groupId}`);

    // Log the user message to simulator chat history
    await WhatsAppChatModel.create({
      id: `real-usr-msg-${Date.now()}`,
      sender: 'user',
      senderName: user.name,
      text: text || `Sent an attachment [${type}] 📁`,
      timestamp: new Date().toISOString()
    });

    if (messageId) {
      await sendTypingIndicator(from, messageId);
    }

    // Download image if type is image
    if (type === 'image' && message.image?.id) {
      console.log(`[${traceId}] Image attachment detected. Media ID: ${message.image.id}`);
      console.log(`[${traceId}] OCR Started`);
      try {
        base64Image = await downloadWhatsAppMedia(message.image.id);
        console.log(`[${traceId}] OCR Finished. Successfully downloaded image media.`);
      } catch (err: any) {
        console.error(`[${traceId}] OCR Failed: Image download failure:`, err);
        await sendWhatsAppMessage(from, '❌ Failed to process the uploaded image receipt. Please try sending a plain text description.');
        return;
      }
    }

    // Run unified message flow processor
    console.log(`[${traceId}] Processing message flow`);
    const replyText = await handleIncomingMessageFlow(text, base64Image, user, cleanFrom, false, traceId);

    // Send reply via WhatsApp
    console.log(`[${traceId}] Reply Sent. Sending reply to ${from}: "${replyText}"`);
    await sendWhatsAppMessage(from, replyText);

    // Log bot reply to simulator history
    await WhatsAppChatModel.create({
      id: `real-bot-msg-${Date.now()}`,
      sender: 'bot',
      text: replyText,
      timestamp: new Date().toISOString()
    });
    console.log(`[${traceId}] Bot reply logged.`);
  } catch (err: any) {
    console.error(`[${traceId}] PROCESSOR CRASH:`, err);
  }
}

// Real WhatsApp Webhook Event Notifications Receiver Endpoint
app.post('/api/whatsapp/webhook', async (req, res) => {
  const { body } = req;
  console.log('[WhatsApp Webhook] Received webhook payload:', JSON.stringify(body, null, 2));

  if (body.object !== 'whatsapp_business_account') {
    console.log(`[WhatsApp Webhook] Bypassing non-whatsapp_business_account object: ${body.object}`);
    return res.status(200).send('EVENT_RECEIVED');
  }

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log('[WhatsApp Webhook] No message object found in webhook payload.');
      return res.status(200).send('EVENT_RECEIVED');
    }

    const messageId = message?.id;
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
    console.log(`[${traceId}] Received`);

    // Process synchronously to ensure serverless containers don't freeze before completion
    await processWebhookMessageAsync(message, traceId);

    // Return 200 OK
    return res.status(200).send('EVENT_RECEIVED');
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Fatal error processing event:', error);
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
    return res.status(400).json({ error: 'Empty advisor prompt message payload' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MOCK_KEY_IF_ABSENT' || apiKey.trim() === '') {
    return res.status(400).json({
      error: 'GEMINI_API_KEY_MISSING',
      message: 'GEMINI_API_KEY is not configured in your environment or .env.local. Please add a valid API key to .env.local and restart the server to use the AI Financial Advisor.'
    });
  }

  try {
    const userId = req.user.id;
    const user = await UserModel.findOne({ id: userId });
    if (!user) {
      return res.status(400).json({ error: 'User context is missing in database' });
    }

    // 1. Fetch current database state
    const dbState = await getDBState(userId);

    // 2. Prepare text context summarizing expenses, groups, and settlements
    const groupsString = dbState.groups.map(g => `- Group ID: ${g.id}, Name: ${g.name}`).join('\n');
    const usersString = dbState.users.map(u => `- Member Name: ${u.name}, ID: ${u.id}, Group ID: ${u.groupId}, Role: ${u.role}`).join('\n');
    
    // Map user IDs to names for readability in expense log
    const userMap: { [id: string]: string } = {};
    dbState.users.forEach(u => {
      userMap[u.id] = u.name;
    });
    const groupMap: { [id: string]: string } = {};
    dbState.groups.forEach(g => {
      groupMap[g.id] = g.name;
    });

    const expensesString = dbState.expenses.map(e => {
      const payer = userMap[e.paidBy] || e.paidBy;
      const grp = groupMap[e.groupId] || e.groupId;
      return `- Date: ${e.date}, Amount: ₹${e.amount}, Category: ${e.category}, Paid By: ${payer}, Group: ${grp}, Merchant: ${e.merchant}, Notes: ${e.notes}`;
    }).join('\n') || 'No expenses logged yet.';

    const settlementsString = dbState.settlements.map(s => {
      const fromG = groupMap[s.fromGroup] || s.fromGroup;
      const toG = groupMap[s.toGroup] || s.toGroup;
      return `- Date: ${s.date}, Amount: ₹${s.amount}, Status: ${s.status}, From: ${fromG}, To: ${toG}, Notes: ${s.notes || ''}`;
    }).join('\n') || 'No settlements logged yet.';

    const today = new Date().toISOString().split('T')[0];

    // 3. System instruction text
    const systemInstruction = `
You are "Sharma Finance Advisor", a premium, wise, and helpful AI financial consultant for the Sharma family assembly.
Your goal is to analyze the family's expense ledger, groups, users, and settlements, and provide personalized, highly contextual financial insights, saving strategies, group-wise spending breakdowns, and answer any queries.

DATABASE CONTEXT:
- Family Name: ${dbState.family?.name || 'Sharma Family Assembly'}
- Groups (Couples/Parents):
${groupsString}
- Members:
${usersString}
- Expenses Logged:
${expensesString}
- Settlements Engine Data:
${settlementsString}

Current Date Today: ${today}
Current User Chatting with you: ${user.name} (Group: ${groupMap[user.groupId] || user.groupId})

RULES & STYLE:
1. Be polite, encouraging, professional yet warm, using finance/wealth metaphors when appropriate.
2. Structure your response using markdown. Use tables, bold headers, list bullet points, and highlight metrics (like ₹ amounts) to make it visually premium and readable.
3. When answering queries about category spending, compute exact sums if possible.
4. Offer action-oriented suggestions (e.g., "Couple 2 is spending 40% of the dining out budget, they could cook at home to save ₹X").
5. Refer to family members by their names (e.g., Chetan, Naveen, Sneha, Riyati, Papa, Mummy).
6. Ground your answers ONLY in the provided database context. If there are no expenses yet, welcome the family and suggest adding their first expense to unlock advice!
7. Keep responses concise and focused on the user's query. Do not reference raw IDs like 'grp-1' or 'usr-2' in your messages, use their names or group display names instead.
`;

    // 4. Save user message to MongoDB
    await AdvisorChatModel.create({
      id: `adv-usr-msg-${Date.now()}`,
      userId,
      role: 'user',
      text,
      timestamp: new Date().toISOString()
    });

    // 5. Gather chat history for Gemini model context
    // Fetch all advisor messages for this user (including the new user message we just saved)
    const chatHistory = await AdvisorChatModel.find({ userId }).sort({ timestamp: 1 });
    
    // Format messages for the new Gemini Client generateContent API
    // The history needs to match contents format: [{role: 'user' | 'model', parts: [{text: string}]}]
    const contents = chatHistory.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction
      }
    });

    const replyText = response.text || "I apologize, but I could not formulate an advice right now. Please try again.";

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
    console.error('Advisor Chat Error:', error);
    let message = error.message || 'Unknown server error';
    if (message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      message = 'The configured GEMINI_API_KEY is invalid. Please double check your key in your .env.local file.';
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
  const { fromGroup, toGroup, amount, notes } = req.body;
  if (!fromGroup || !toGroup || !amount) {
    return res.status(400).json({ error: 'Missing settlement fields' });
  }

  try {
    const newSettlement = await SettlementModel.create({
      id: `set-${Date.now()}`,
      fromGroup,
      toGroup,
      amount: Number(amount),
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      notes: notes || 'Settlement calculated by settlement engine'
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

// Outgoing Daily WhatsApp Reminders Helper
let lastRunDate: string = '';

export async function sendDailyWhatsAppReminders(todayStr: string) {
  console.log(`[Reminder Scheduler] Sending daily reminders to all users for date: ${todayStr}`);
  try {
    // 1. Fetch all users with registered WhatsApp numbers
    const users = await UserModel.find({ whatsappNumber: { $exists: true, $ne: '' } });
    if (users.length === 0) {
      console.log('[Reminder Scheduler] No users found with linked WhatsApp numbers.');
      return;
    }

    console.log(`[Reminder Scheduler] Sending reminders to ${users.length} users.`);

    // 2. Send reminders to all users
    for (const user of users) {
      console.log(`[Reminder Scheduler] Sending WhatsApp reminder to ${user.name} (${user.whatsappNumber})...`);
      
      const messageText = `👋 *Hi ${user.name}!* \n\nThis is your daily reminder from *FamBudget Bot*. 🤖📱\n\nIf you spent anything today, reply directly to this chat (e.g. "Spent 600 at Starbucks for coffee today" or attach a transaction screenshot) to log it! 💰💸`;

      await sendWhatsAppMessage(user.whatsappNumber, messageText);

      // Also log this outgoing bot message in the WhatsApp Chat history so it shows in the UI
      await WhatsAppChatModel.create({
        id: `bot-reminder-${Date.now()}-${user.id}`,
        sender: 'bot',
        text: messageText,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('[Reminder Scheduler] Error running daily reminders:', err);
  }
}

// Background scheduler checker running every 30 seconds
export function startDailyReminderScheduler() {
  console.log('[Reminder Scheduler] Daily WhatsApp reminder scheduler started. Checks daily at 19:30 (7:30 PM) IST.');
  setInterval(async () => {
    const now = new Date();
    
    // Get current time in Asia/Kolkata (IST)
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const [istHourStr, istMinStr] = timeFormatter.format(now).split(':');
    const hours = parseInt(istHourStr, 10);
    const minutes = parseInt(istMinStr, 10);

    if (hours === 19 && minutes === 30) {
      // Get date string in Asia/Kolkata (IST)
      const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const todayStr = dateFormatter.format(now);
      
      if (lastRunDate !== todayStr) {
        lastRunDate = todayStr;
        await sendDailyWhatsAppReminders(todayStr);
      }
    }
  }, 30000);
}

// Manual testing route to force-trigger daily reminders immediately
app.post('/api/test/trigger-reminders', authenticateJWT, async (req: any, res) => {
  try {
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = dateFormatter.format(now);
    await sendDailyWhatsAppReminders(todayStr);
    res.json({ success: true, message: 'Daily WhatsApp reminders triggered successfully.' });
  } catch (err: any) {
    res.status(550).json({ error: 'Failed to trigger reminders', message: err.message });
  }
});

// Public trigger route for local testing or Vercel Cron
app.all('/api/cron/reminders', async (req: any, res) => {
  console.log('[Cron Endpoint] Daily reminders cron triggered manually/externally.');
  try {
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = dateFormatter.format(now);
    await sendDailyWhatsAppReminders(todayStr);
    res.json({ success: true, message: `Daily WhatsApp reminders triggered successfully for ${todayStr}.` });
  } catch (err: any) {
    console.error('[Cron Endpoint] Trigger failed:', err);
    res.status(500).json({ error: 'Failed to trigger reminders', message: err.message });
  }
});

// ------------------- VITE & STATIC HANDLING -------------------
export async function startServer() {
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

  // Start the background WhatsApp reminder scheduler
  startDailyReminderScheduler();

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
