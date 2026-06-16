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
  AdvisorChatModel
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
      name: 'Mehta Family Assembly',
      createdAt: new Date().toISOString()
    });

    const groups = [
      { id: 'grp-1', name: 'Couple 1 (Naveen & Sneha)', familyId },
      { id: 'grp-2', name: 'Couple 2 (Chetan & Riyati)', familyId },
      { id: 'grp-3', name: 'Parents (Papa & Mummy)', familyId }
    ];
    await GroupModel.insertMany(groups);

    const whatsappChat = [
      {
        id: 'chat-1',
        sender: 'bot' as const,
        text: 'Hello Mehta Family! I am FamBudget, your automated Expense Agent. 🤖📱\n\nSend me text like "Paid ₹850 for vegetables" or drop any mobile transaction screenshot (GPay, PhonePe, Paytm, etc.) right here to instantly log expenses!',
        timestamp: new Date().toISOString()
      }
    ];
    await WhatsAppChatModel.insertMany(whatsappChat);

    console.log('Seeding Mehta Family structures complete!');
  } catch (err) {
    console.error('Failed to seed default Mehta Family database:', err);
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
  const { name, email, password, groupId, role } = req.body;
  if (!name || !email || !password || !groupId) {
    return res.status(400).json({ error: 'Missing mandatory registration credentials' });
  }

  try {
    const userExists = await UserModel.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ error: 'A member profile with this email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await UserModel.create({
      id: `usr-${Date.now()}`,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      groupId,
      role: role || 'member'
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET
    );

    res.json({
      success: true,
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, groupId: newUser.groupId }
    });
  } catch (err: any) {
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
app.post('/api/db-reset', authenticateJWT, async (req: any, res) => {
  try {
    await Promise.all([
      FamilyModel.deleteMany({}),
      GroupModel.deleteMany({}),
      UserModel.deleteMany({}),
      ExpenseModel.deleteMany({}),
      SettlementModel.deleteMany({}),
      WhatsAppChatModel.deleteMany({}),
      AdvisorChatModel.deleteMany({})
    ]);

    await seedDatabase();
    const state = await getDBState(req.user.id);
    res.json({ message: 'Database reset succeeded', data: state });
  } catch (err: any) {
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
  const { name, email, groupId, role } = req.body;
  if (!name || !email || !groupId) {
    return res.status(400).json({ error: 'Missing user parameters' });
  }

  try {
    const userExists = await UserModel.findOne({ email: email.toLowerCase() });
    if (userExists) return res.status(400).json({ error: 'Email already registered' });

    // Hash a placeholder password since administrative onboard does not require immediate password fill
    const salt = await bcrypt.genSalt(10);
    const placeHash = await bcrypt.hash('password123', salt);

    const newUser = await UserModel.create({
      id: `usr-${Date.now()}`,
      name,
      email: email.toLowerCase(),
      password: placeHash,
      groupId,
      role: role || 'member'
    });

    const state = await getDBState(req.user.id);
    res.json({ success: true, user: newUser, state });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create user', message: err.message });
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
      category: category || 'Uncategorized',
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
      - Grocery
      - Utilities
      - Dining Out
      - Rent & Living
      - Vegetables & Fruits
      - Medical
      - Entertainment
      - Travel & Commute
      - Shopping
      - Uncategorized
      
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

// WhatsApp Bot Chat Integration via AI Simulator
let whatsappContext: any = null;

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
      text: text || 'Uploaded an image 📁',
      timestamp: new Date().toISOString(),
      image: base64Image
    });

    const today = new Date().toISOString().split('T')[0];
    const ai = getAiClient();
    
    const [groupsList, usersList] = await Promise.all([
      GroupModel.find(),
      UserModel.find()
    ]);

    const groupsString = groupsList.map(g => `Group ID: ${g.id}, Name: ${g.name}`).join('\n');
    const usersString = usersList.map(u => `User Name: ${u.name}, ID: ${u.id}, Group: ${u.groupId}`).join('\n');
    const categoriesList = ['Rent & Living', 'Utilities', 'Groceries', 'Vegetables & Fruits', 'Dining Out', 'Medical', 'Shopping', 'Travel & Commute', 'Others'];

    const userGroup = groupsList.find(g => g.id === user.groupId);

    // If confirming a pending proposal
    if (whatsappContext && text && /^(yes|yeah|yup|y|confirm|ok|okay|save|correct|agree|indeed)/i.test(text.trim())) {
      const exp = whatsappContext;
      const spender = usersList.find(u => u.id === exp.paidBy) || user;
      const spenderGroup = groupsList.find(g => g.id === exp.groupId) || userGroup;

      await ExpenseModel.create({
        id: `exp-${Date.now()}`,
        amount: Number(exp.amount),
        category: exp.category,
        paidBy: exp.paidBy,
        groupId: exp.groupId,
        date: exp.date,
        notes: exp.notes,
        merchant: exp.merchant,
        originalImage: exp.originalImage,
        createdAt: new Date().toISOString()
      });

      await WhatsAppChatModel.create({
        id: `bot-msg-${Date.now()}`,
        sender: 'bot',
        text: `✅ *Expense Confirmed and Logged!* \n\n💰 *Amount:* ₹${exp.amount}\n🏢 *Merchant:* ${exp.merchant}\n🏷️ *Category:* ${exp.category}\n👤 *Paid By:* ${spender.name} (${spenderGroup?.name})\n📅 *Date:* ${exp.date}\n📝 *Notes:* ${exp.notes}\n\nAll family dashboards updated in real time! 🚀`,
        timestamp: new Date().toISOString()
      });

      whatsappContext = null;
      const state = await getDBState(req.user.id);
      return res.json(state);
    }

    let contents: any[] = [];
    if (base64Image) {
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      });
    }

    const aiPrompt = `
      You are "FamBudget Bot", an automated Indian WhatsApp bot assistant for private family budget Logging.
      Current Date Today: ${today}
      
      FAMILY GROUPS:
      ${groupsString}
      
      FAMILY MEMBERS AVAILABLE:
      ${usersString}
      
      STANDARD CATEGORIES:
      ${categoriesList.join(', ')}
      
      Current User Sender: User ${user.name} (belongs to group ${userGroup?.name}).
      
      Your goal:
      1. Interpret the user text "${text || 'payment receipt screenshot'}" and parse if it's an expense log.
      2. If it is an expense:
         - Extract Amount (in INR, numbers), Merchant (Store name), Date (YYYY-MM-DD or today), Category, Notes.
         - Identify who paid. (Usually the sender: "${user.name}", unless specified otherwise in the text e.g., "Amit paid ₹300").
         - Map the "groupId" to the group of the person who paid.
      3. Format a lovely friendly Indian WhatsApp bot response. Use emojis (📱, 💰, 🤖, etc.), bold styling e.g., *bold text* like standard WhatsApp formatting.
      4. If crucial info like amount is missing, politely ask the user for it in a chat reply.
      5. Outputs structure in raw JSON matching:
      {
        "reply": "Friendly WhatsApp bot message",
        "expenseProposed": {
          "amount": number,
          "category": "string",
          "paidBy": "usr-id-of-person-who-paid",
          "groupId": "group-id-of-person-who-paid",
          "date": "YYYY-MM-DD",
          "merchant": "string",
          "notes": "string"
        } | null,
        "needsConfirmation": boolean
      }
    `;
    contents.push({ text: aiPrompt });

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['reply', 'expenseProposed', 'needsConfirmation'],
          properties: {
            reply: { type: Type.STRING },
            expenseProposed: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
                paidBy: { type: Type.STRING },
                groupId: { type: Type.STRING },
                date: { type: Type.STRING },
                merchant: { type: Type.STRING },
                notes: { type: Type.STRING }
              }
            },
            needsConfirmation: { type: Type.BOOLEAN }
          }
        }
      }
    });

    const parsedResult = JSON.parse(aiResponse.text || '{}');
    
    if (parsedResult.expenseProposed && parsedResult.needsConfirmation) {
      whatsappContext = {
        ...parsedResult.expenseProposed,
        originalImage: base64Image
      };
    } else {
      whatsappContext = null;
    }

    await WhatsAppChatModel.create({
      id: `bot-msg-${Date.now()}`,
      sender: 'bot',
      text: parsedResult.reply || 'Thanks for logging! Keep tracking.',
      timestamp: new Date().toISOString()
    });

    const state = await getDBState(req.user.id);
    res.json(state);

  } catch (error: any) {
    console.error('WhatsApp Bot AI Simulator Error:', error);
    await WhatsAppChatModel.create({
      id: `bot-msg-err-${Date.now()}`,
      sender: 'bot',
      text: `Sorry 😔, I ran into an error reading that. Please make sure the expense details are visible. Details: ${error.message}`,
      timestamp: new Date().toISOString()
    });
    const state = await getDBState(req.user.id);
    res.json(state);
  }
});

// Clear WhatsApp Simulator chat logs
app.post('/api/whatsapp/clear', authenticateJWT, async (req: any, res) => {
  try {
    await WhatsAppChatModel.deleteMany({});
    await WhatsAppChatModel.create({
      id: 'chat-1',
      sender: 'bot',
      text: 'Hello Mehta Family! I am FamBudget, your automated Expense Agent. 🤖📱\n\nSend me text like "Paid ₹850 for vegetables" or drop any mobile transaction screenshot (GPay, PhonePe, Paytm, etc.) right here to instantly log expenses!',
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
You are "Mehta Finance Advisor", a premium, wise, and helpful AI financial consultant for the Mehta family assembly.
Your goal is to analyze the family's expense ledger, groups, users, and settlements, and provide personalized, highly contextual financial insights, saving strategies, group-wise spending breakdowns, and answer any queries.

DATABASE CONTEXT:
- Family Name: ${dbState.family?.name || 'Mehta Family Assembly'}
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started on port http://localhost:${PORT}`);
  });
}

// ------------------- CONNECT TO MONGO HELPER -------------------
export async function connectDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/familyfunds';
  console.log('Connecting to MongoDB at URI:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB successfully connected.');
}
