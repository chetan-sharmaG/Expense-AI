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
  WhatsAppSessionModel
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
      { id: 'grp-2', name: 'Couple 2 (Chetan & Riyati)', familyId },
      { id: 'grp-3', name: 'Parents (Papa & Mummy)', familyId }
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
// WhatsApp AI Parsing helper
async function parseExpenseWithAi(text?: string, base64Image?: string, senderUser?: any) {
  const today = new Date().toISOString().split('T')[0];
  const ai = getAiClient();
  
  const [groupsList, usersList] = await Promise.all([
    GroupModel.find(),
    UserModel.find()
  ]);

  const groupsString = groupsList.map(g => `Group ID: ${g.id}, Name: ${g.name}`).join('\n');
  const usersString = usersList.map(u => `User Name: ${u.name}, ID: ${u.id}, Group: ${u.groupId}`).join('\n');
  const categoriesList = ['Rent & Living', 'Utilities', 'Groceries', 'Vegetables & Fruits', 'Dining Out', 'Medical', 'Shopping', 'Travel & Commute', 'Others'];

  const userGroup = senderUser ? groupsList.find(g => g.id === senderUser.groupId) : null;
  const senderName = senderUser ? senderUser.name : 'Unknown User';

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
    
    Current User Sender: User ${senderName} (belongs to group ${userGroup?.name || 'Unknown'}).
    
    Your goal:
    1. Interpret the user text "${text || 'payment receipt screenshot'}" and parse if it's an expense log.
    2. If it is an expense:
       - Extract Amount (in INR, numbers), Merchant (Store name), Date (YYYY-MM-DD or today), Category, Notes.
       - Identify who paid. (Usually the sender: "${senderName}", unless specified otherwise in the text e.g., "Amit paid ₹300").
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

  return JSON.parse(aiResponse.text || '{}');
}

// WhatsApp Real Webhook Helpers
async function downloadWhatsAppMedia(mediaId: string): Promise<string> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');

  const mediaUrlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
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

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
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

// Simulated WhatsApp context
let whatsappContext: any = null;

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

    const [groupsList, usersList] = await Promise.all([
      GroupModel.find(),
      UserModel.find()
    ]);
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

      const confirmText = `✅ *Expense Confirmed and Logged!* \n\n💰 *Amount:* ₹${exp.amount}\n🏢 *Merchant:* ${exp.merchant}\n🏷️ *Category:* ${exp.category}\n👤 *Paid By:* ${spender.name} (${spenderGroup?.name})\n📅 *Date:* ${exp.date}\n📝 *Notes:* ${exp.notes}\n\nAll family dashboards updated in real time! 🚀`;

      await WhatsAppChatModel.create({
        id: `bot-msg-${Date.now()}`,
        sender: 'bot',
        text: confirmText,
        timestamp: new Date().toISOString()
      });

      whatsappContext = null;
      const state = await getDBState(req.user.id);
      return res.json(state);
    }

    // Call reusable AI parser helper
    const parsedResult = await parseExpenseWithAi(text, base64Image, user);

    if (parsedResult.expenseProposed) {
      if (parsedResult.needsConfirmation) {
        whatsappContext = {
          ...parsedResult.expenseProposed,
          originalImage: base64Image
        };
      } else {
        await ExpenseModel.create({
          id: `exp-${Date.now()}`,
          amount: Number(parsedResult.expenseProposed.amount),
          category: parsedResult.expenseProposed.category || 'Others',
          paidBy: parsedResult.expenseProposed.paidBy || user.id,
          groupId: parsedResult.expenseProposed.groupId || user.groupId,
          date: parsedResult.expenseProposed.date || new Date().toISOString().split('T')[0],
          notes: parsedResult.expenseProposed.notes || '',
          merchant: parsedResult.expenseProposed.merchant || 'Unknown Merchant',
          originalImage: base64Image,
          createdAt: new Date().toISOString()
        });
        whatsappContext = null;
      }
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

    const from = message.from;
    const text = message.text?.body;
    const type = message.type;
    let base64Image: string | undefined;

    console.log(`[WhatsApp Webhook] Processing message: from=${from}, type=${type}, text=${text}`);

    // Find linked user profile by phone number (removing non-digits)
    const cleanFrom = from.replace(/\D/g, '');
    console.log(`[WhatsApp Webhook] Lookup user by whatsappNumber pattern matching: ${cleanFrom}`);
    
    const user = await UserModel.findOne({
      whatsappNumber: { $regex: new RegExp(`^${cleanFrom}$`) }
    });

    if (!user) {
      console.warn(`[WhatsApp Webhook] NO LINKED USER FOUND for phone number: ${cleanFrom}`);
      console.log(`[WhatsApp Webhook] Dispatching "Welcome/Unlinked" warning reply to ${from}`);
      await sendWhatsAppMessage(
        from,
        `⚠️ *Welcome to FamilyFunds!* \n\nYour WhatsApp number is not linked to any member profile in our system. \n\n👉 Please log in to the FamilyFunds app, navigate to the *Family & Groups* settings, and link this phone number (*${from}*) to your profile to enable automatic expense logging! 🚀`
      );
      return res.status(200).send('EVENT_RECEIVED');
    }
    
    console.log(`[WhatsApp Webhook] Found linked user: ${user.name} (${user.id}), Group: ${user.groupId}`);

    // Log the user message to simulator chat history
    await WhatsAppChatModel.create({
      id: `real-usr-msg-${Date.now()}`,
      sender: 'user',
      senderName: user.name,
      text: text || `Sent an attachment [${type}] 📁`,
      timestamp: new Date().toISOString()
    });
    console.log(`[WhatsApp Webhook] Logged user message to WhatsAppChatModel history.`);

    // Check if there is an active confirmation session
    console.log(`[WhatsApp Webhook] Checking for active confirmation session for number: ${cleanFrom}`);
    const session = await WhatsAppSessionModel.findOne({ phoneNumber: cleanFrom });

    // Handle confirmation response
    if (session && text && /^(yes|yeah|yup|y|confirm|ok|okay|save|correct|agree|indeed)/i.test(text.trim())) {
      console.log(`[WhatsApp Webhook] User responded with confirmation keyword. Session details:`, JSON.stringify(session, null, 2));
      const exp = session.pendingExpense;
      if (exp) {
        const newExpense = await ExpenseModel.create({
          id: `exp-${Date.now()}`,
          amount: exp.amount,
          category: exp.category || 'Uncategorized',
          paidBy: exp.paidBy,
          groupId: exp.groupId,
          date: exp.date,
          notes: exp.notes,
          merchant: exp.merchant,
          originalImage: exp.originalImage,
          createdAt: new Date().toISOString()
        });
        console.log(`[WhatsApp Webhook] Expense successfully created in DB:`, newExpense.id);

        await WhatsAppSessionModel.deleteOne({ phoneNumber: cleanFrom });
        console.log(`[WhatsApp Webhook] Cleared pending session for number: ${cleanFrom}`);

        const replyText = `✅ *Expense Confirmed and Logged!* \n\n💰 *Amount:* ₹${exp.amount}\n🏢 *Merchant:* ${exp.merchant}\n🏷️ *Category:* ${exp.category}\n👤 *Paid By:* ${user.name}\n📅 *Date:* ${exp.date}\n📝 *Notes:* ${exp.notes}\n\nFamily ledger updated successfully! 🚀`;
        
        console.log(`[WhatsApp Webhook] Sending confirmation success reply to ${from}`);
        await sendWhatsAppMessage(from, replyText);

        await WhatsAppChatModel.create({
          id: `real-bot-msg-${Date.now()}`,
          sender: 'bot',
          text: replyText,
          timestamp: new Date().toISOString()
        });
      }
      return res.status(200).send('EVENT_RECEIVED');
    }

    // Download image if type is image
    if (type === 'image' && message.image?.id) {
      console.log(`[WhatsApp Webhook] Image attachment detected. Media ID: ${message.image.id}`);
      try {
        base64Image = await downloadWhatsAppMedia(message.image.id);
        console.log(`[WhatsApp Webhook] Successfully downloaded image media. Length: ${base64Image.length} characters.`);
      } catch (err: any) {
        console.error('[WhatsApp Webhook] Image download failure:', err);
        await sendWhatsAppMessage(from, '❌ Failed to process the uploaded image receipt. Please try sending a plain text description.');
        return res.status(200).send('EVENT_RECEIVED');
      }
    }

    // Process using AI expense parser
    console.log(`[WhatsApp Webhook] Invoking parseExpenseWithAi...`);
    const parsedResult = await parseExpenseWithAi(text, base64Image, user);
    console.log(`[WhatsApp Webhook] AI parser output parsedResult:`, JSON.stringify(parsedResult, null, 2));

    // Save/Clear confirmation session
    if (parsedResult.expenseProposed) {
      if (parsedResult.needsConfirmation) {
        console.log(`[WhatsApp Webhook] Saving pending confirmation session for number: ${cleanFrom}`);
        await WhatsAppSessionModel.updateOne(
          { phoneNumber: cleanFrom },
          {
            phoneNumber: cleanFrom,
            pendingExpense: {
              amount: parsedResult.expenseProposed.amount,
              category: parsedResult.expenseProposed.category,
              paidBy: user.id,
              groupId: user.groupId,
              date: parsedResult.expenseProposed.date || new Date().toISOString().split('T')[0],
              notes: parsedResult.expenseProposed.notes || '',
              merchant: parsedResult.expenseProposed.merchant || 'Unknown Merchant',
              originalImage: base64Image
            },
            updatedAt: new Date().toISOString()
          },
          { upsert: true }
        );
        console.log(`[WhatsApp Webhook] Session saved successfully.`);
      } else {
        console.log(`[WhatsApp Webhook] No confirmation needed. Creating expense immediately in DB.`);
        const newExpense = await ExpenseModel.create({
          id: `exp-${Date.now()}`,
          amount: Number(parsedResult.expenseProposed.amount),
          category: parsedResult.expenseProposed.category || 'Others',
          paidBy: parsedResult.expenseProposed.paidBy || user.id,
          groupId: parsedResult.expenseProposed.groupId || user.groupId,
          date: parsedResult.expenseProposed.date || new Date().toISOString().split('T')[0],
          notes: parsedResult.expenseProposed.notes || '',
          merchant: parsedResult.expenseProposed.merchant || 'Unknown Merchant',
          originalImage: base64Image,
          createdAt: new Date().toISOString()
        });
        console.log(`[WhatsApp Webhook] Expense created directly:`, newExpense.id);
        await WhatsAppSessionModel.deleteOne({ phoneNumber: cleanFrom });
      }
    } else {
      console.log(`[WhatsApp Webhook] No expense proposed. Clearing any active session for: ${cleanFrom}`);
      await WhatsAppSessionModel.deleteOne({ phoneNumber: cleanFrom });
    }

    // Send reply via WhatsApp
    console.log(`[WhatsApp Webhook] Sending reply to ${from}: "${parsedResult.reply}"`);
    await sendWhatsAppMessage(from, parsedResult.reply);

    // Log bot reply to simulator history
    await WhatsAppChatModel.create({
      id: `real-bot-msg-${Date.now()}`,
      sender: 'bot',
      text: parsedResult.reply,
      timestamp: new Date().toISOString()
    });
    console.log(`[WhatsApp Webhook] Bot reply logged to WhatsAppChatModel history.`);

    res.status(200).send('EVENT_RECEIVED');
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
