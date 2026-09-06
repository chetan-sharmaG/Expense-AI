# FamilyFunds — Project Documentation: Features & Routes

FamilyFunds is a multi-group financial ledger, zero-sum settlement engine, server-side receipt OCR engine, and AI-assisted financial advisor tailored for joint family groups (e.g., Sharma Family Assembly). It features dynamic client-side SPA routing via React Router v7, a RESTful Express backend API, Groq AI and Google Gemini integration, and direct WhatsApp Cloud API webhook automation.

---

## 🛠️ Technology Stack & Architecture

- **Frontend Core**: React 19, TypeScript, React Router v7, Lucide Icons, Recharts, Motion (Framer Motion).
- **Styling**: TailwindCSS v4, Glassmorphism design system, HSL dark mode palettes (`#07090e`, `#0d101d`).
- **Backend API**: Node.js, Express, TSX, esbuild.
- **Database & State**: MongoDB / Mongoose ODM (with fallback to `mongodb-memory-server` in development).
- **Authentication**: JWT (JSON Web Tokens) with `bcryptjs` password hashing and header verification.
- **Artificial Intelligence**:
  - **Groq API** (`openai/gpt-oss-120b`): Powers the read-only AI Financial Advisor and WhatsApp natural language intent parser.
  - **Google Gemini API** (`gemini-3.5-flash`): Multi-modal receipt OCR and transaction extraction engine.
- **Integrations**: Meta WhatsApp Cloud API (`v23.0`), Vercel Serverless & Rewrite Router.

---

## 🗺️ Client-Side SPA Routes & Views

Client-side routes are defined in [`src/App.tsx`](file:///d:/Chetan_UI/Expense/src/App.tsx) using React Router v7. Unauthenticated users are redirected to the JWT authentication vault screen.

| Route Path | View Component | Description & Key Features |
| :--- | :--- | :--- |
| `/` | `Navigate` | Redirects automatically to `/dashboard`. |
| `/dashboard` | [`DashboardView`](file:///d:/Chetan_UI/Expense/src/components/DashboardView.tsx) | **Analytics Dashboard**: Displays key metric cards (Total Spent, Monthly Target, Net Balances, Unsettled Debts), 10-day splurge trend line, category breakdown donut chart, couple contribution bar chart, and spender rankings. |
| `/analysis` | [`AnalysisView`](file:///d:/Chetan_UI/Expense/src/components/AnalysisView.tsx) | **Deep Financial Analytics**: Advanced metrics breakdown, monthly trend analysis, spending per group/category, and comparative metrics. |
| `/expenses` | [`ExpensesView`](file:///d:/Chetan_UI/Expense/src/components/ExpensesView.tsx) | **Family Ledger**: Interactive expense table with category filters, date range selection, paid member/group filters, receipt screenshot lightbox viewer, receipt OCR upload, and expense CRUD modal. |
| `/settlement` | [`SettlementView`](file:///d:/Chetan_UI/Expense/src/components/SettlementView.tsx) | **Settlement Engine**: Automated zero-sum debt matrix calculating who owes whom, bank-invoice receipt generator, manual debt clearance logging, and settlement history. |
| `/family` | [`FamilyView`](file:///d:/Chetan_UI/Expense/src/components/FamilyView.tsx) | **Family & Group Administration**: Manage couple/parent groups, set group monthly budgets, onboard new family members, assign roles (`admin`/`member`), and link real WhatsApp numbers. |
| `/advisor` | [`AdvisorView`](file:///d:/Chetan_UI/Expense/src/components/AdvisorView.tsx) | **AI Financial Advisor**: In-app private financial consulting chat powered by Groq (`openai/gpt-oss-120b`). Contextually aware of live database metrics with quick action suggestion chips. |
| `*` | `Navigate` | Wildcard route; redirects to `/dashboard`. |

---

## ⚡ Backend REST API & Webhook Endpoints

All backend endpoints are defined in [`server.ts`](file:///d:/Chetan_UI/Expense/server.ts) and routed through [`api/index.ts`](file:///d:/Chetan_UI/Expense/api/index.ts) on Vercel Serverless.

### 1. Authentication & System Health

| HTTP Method | Route Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/ping` | No | Diagnostic health check returning Vercel execution state and environment variable status. Defined in [`api/ping.ts`](file:///d:/Chetan_UI/Expense/api/ping.ts). |
| `POST` | `/api/auth/register` | No | Registers a new family member profile with hashed password and optional WhatsApp number linking. |
| `POST` | `/api/auth/login` | No | Verifies user credentials (`email` + `password`) and returns a signed JWT token + user profile. |
| `GET` | `/api/auth/me` | Yes (`Bearer Token`) | Returns current authenticated user profile object. |
| `GET` | `/api/public/groups` | No | Public endpoint returning existing family groups for registration dropdown selection. |

### 2. Database State & Admin Operations

| HTTP Method | Route Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/db-state` | Yes | Retrieves full database state (family, groups, users excluding passwords, expenses, settlements, chats). |
| `POST` | `/api/db-reset` | No | Factory reset: Wipes all collections and re-seeds default Sharma Family structure (`grp-1`, `grp-2`). |
| `POST` | `/api/db-clean-expenses` | Yes | Resets expenses, settlements, and chat history while preserving users and family groups. |

### 3. Family & Group Management

| HTTP Method | Route Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/groups` | Yes | Creates a new family/couple group. |
| `PUT` | `/api/groups/:id/budget` | Yes | Updates the monthly spending budget target for a specified group. |
| `DELETE` | `/api/groups/:id` | Yes | Deletes a family group and reassigns its members to a default group. |
| `POST` | `/api/users` | Yes | Onboards a new user profile into a group with pre-hashed placeholder credentials. |
| `PUT` | `/api/users/:id` | Yes | Updates member profile details (name, email, group assignment, role, linked WhatsApp number). |
| `DELETE` | `/api/users/:id` | Yes | Removes a user profile from the database. |

### 4. Expense Management & Receipt OCR

| HTTP Method | Route Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/expenses` | Yes | Logs a new expense record into the ledger (supports base64 receipt attachment). |
| `PUT` | `/api/expenses/:id` | Yes | Edits an existing expense record (group-ownership permissions enforced). |
| `DELETE` | `/api/expenses/:id` | Yes | Deletes an expense record (group-ownership permissions enforced). |
| `POST` | `/api/ocr` | Yes | Submits base64 receipt image to Gemini 3.5 Flash for automated OCR extraction (amount, merchant, date, category). |

### 5. Zero-Sum Settlement Engine

| HTTP Method | Route Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/settlements` | Yes | Logs a cross-group debt clearance/settlement record. |
| `PUT` | `/api/settlements/:id/settle` | Yes | Marks a pending settlement record as completed/settled with timestamp. |
| `DELETE` | `/api/settlements/:id` | Yes | Removes a settlement entry from history. |

### 6. Groq AI Financial Advisor

| HTTP Method | Route Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/ai/advisor` | Yes | Sends user query to Groq (`openai/gpt-oss-120b`) with complete live database context; returns markdown advice. |
| `POST` | `/api/ai/advisor/clear` | Yes | Clears private AI advisor chat history for the requesting user. |

### 7. WhatsApp Agent & Meta Cloud API Webhook

| HTTP Method | Route Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/whatsapp/webhook` | Webhook Token | Verification endpoint for Meta WhatsApp Cloud API (`hub.challenge`). |
| `POST` | `/api/whatsapp/webhook` | Meta Webhook | Real-time receiver for incoming WhatsApp messages, image receipts, typing indicators, and interactive button clicks. |
| `POST` | `/api/whatsapp/message` | Yes | In-app simulated WhatsApp bot endpoint for testing agent interactions without Meta API credentials. |
| `POST` | `/api/whatsapp/clear` | Yes | Resets simulated WhatsApp chat history to initial welcome message. |

---

## 🌟 Comprehensive Feature Catalog

### 👥 1. Multi-Group Structure & JWT Security
- Multi-tier hierarchy supporting couples (e.g., *Couple 1*, *Couple 2*) and parents.
- JWT authentication with secure password hashing (`bcryptjs`) and local storage caching.
- Fine-grained write permission controls ensuring users only modify their own couple group's entries.

### 📊 2. Interactive Ledger & Dynamic Filtering
- Responsive expense table with instant searching and filtering by category, date range, spender, and couple group.
- Full-screen glassmorphic receipt viewer for reviewing GPay, Paytm, or physical receipts.
- Visual loading spinners during write operations to prevent duplicate API requests.

### 📈 3. Recharts Analytics & Visualizations
- **Expense Splurge Trend**: 10-day smooth monotone area chart showing daily spending progression.
- **Category Allocation Donut**: Percentage breakdown of spending with hover expansions and top-category callouts.
- **Group Contribution Bar Chart**: Visual comparison of expenditure volume logged across family groups.
- **Spender Leaderboard**: Ranked leaderboard of individual contributors.

### 💸 4. Zero-Sum Settlement Clearing House
- Automatic calculation of group net balances to determine exact debt clearance matrix.
- Generates bank-invoice style receipts for settlement records.
- Supports partial and full debt clearances with custom notes.

### 🤖 5. Groq AI Financial Advisor
- In-app consulting bot powered by Groq (`openai/gpt-oss-120b`).
- Injects live database statistics (spending by category, month-to-date totals, balances) into prompts.
- Read-only guardrails preventing hallucinated database modifications.
- Private chat logs stored per user in MongoDB.

### 💬 6. Live WhatsApp Bot & Multi-Modal Agent Integration
- **Direct Receipt OCR**: Automatic image downloading from Meta API (`v23.0`) and OCR via Gemini.
- **Programmatic Command Router (0-AI Cost)**: Directly handles queries (`summary`, `compare`, `spenders`, `settlement`, `categories`, `search <term>`, `help`) without calling AI models.
- **Merchant Memory**: Learns merchant-category pairings to auto-log matching repeat transactions instantly.
- **Duplicate Prevention**: Detects identical amount & merchant submissions within a 10-minute window and asks for confirmation.
- **Interactive WhatsApp Experience**: Dispatches read receipts, typing indicators ("FamBudget is typing..."), and interactive quick-reply buttons.
- **Session Confirmation Engine**: MongoDB TTL session storage for handling multi-turn expense confirmations.

---
