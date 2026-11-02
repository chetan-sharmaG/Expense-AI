# FamilyFunds — Product Feature Specification

FamilyFunds is a premium, multi-group financial ledger, settlement engine, and AI-assisted budgeting assistant tailored for joint family groups. Below is the complete specification of the features available in the application.

---

## 👥 1. Multi-Group Family Structure & Authentication

Secure, database-driven family onboarding and member coordination:
- **Couples & Parent Coordination Groups**: Spenders are organized into structural units (e.g., Couple 1, Couple 2, Parents).
- **JWT-Protected Vault Gateway**: Secure email/password login and registration pages built with glassmorphic panels. All endpoints require token verification headers.
- **Indefinite Sessions**: Persistent local storage sessions so family members stay logged in across mobile/desktop browsers until they click logout.
- **Member Directories**: View and edit profiles, link real WhatsApp phone numbers, and manage group permissions dynamically.

---

## 📊 2. Interactive Ledger & Mobile Filters

A unified ledger representing family expenditures with responsive styling:
- **Receipt Lightbox Viewer**: View uploaded transaction screenshots and GPay/Paytm invoices in full screen with a blurred glass overlay.
- **Standard Category Taxonomy**: Expenses follow 8 standardized categories:
  `Outside Food`, `Veggies`, `Fruits`, `DMART`, `Bills`, `Mislenious`, `Milk`, `Dining` (with legacy categories retained for past records).
- **Advanced Filtering Drawer**: Slice expense lists by date range, category, paid member, and owning couple group. Collapses into a slide-out menu on mobile.
- **Write Prevention Spinner**: Input components, delete buttons, and edit actions disable dynamically with visual loading spinners during write operations to prevent duplicate API requests.

---

## 📈 3. Dashboard Analytics & Data Visualization

Interactive charts built with Recharts rendering live database summaries:
- **Expense Splurge Trend (Area Chart)**: Displays a 10-day timeline of daily cumulative spending. Features smooth curved lines (`type="monotone"`), glassmorphic custom tooltips, and green gradient fill effects.
- **Category Allocation Donut (Pie Chart)**: Renders the percentage distribution of overall family expenditures across categories. Features padding offsets, hover expansion, a bulleted list of active categories, and displays the top-spent category percentage directly in the center hole contextually.
- **Group Contribution & Comparison (Bar Chart)**: Vertical bar comparisons displaying the total expenditure volume logged by couples/parents groups. Rounded caps (`radius={[8, 8, 0, 0]}`) and custom color palettes are used to represent group distributions.
- **Spender Leaderboard**: Tracks and displays individual members ranked by total spent volume in a vertical, scrollable list.

---

## 💸 4. Settlement Engine

An automated clearing house calculating cross-group debts:
- **Automatic Balances Computation**: Scans all group expenses and computes who owes how much to whom to achieve a perfect 0-sum group balance.
- **Premium Bank Invoice Layout**: Settlement receipts and debt-clearance records are formatted to resemble high-end banking invoices.
- **Manual Debt Clearing**: Register partial or full settlements with custom notes.

---

## 🤖 5. Groq AI Financial Advisor (In-App Chat)

An inline AI consultant providing insights on family spending patterns powered by **Groq** (`openai/gpt-oss-120b`):
- **Context-Aware Reports**: Synchronizes all live database metrics (expenses list, categories, group budgets, settlements) directly with Groq prompts.
- **Private Conversations**: Stores conversation history in MongoDB per `userId`, allowing individual family members to maintain private consulting histories.
- **Quick Action Chips**:
  - `📊 Summarize Spending` - Get instant monthly or weekly budgets summaries.
  - `👥 Compare Groups` - Review spending differences between couples.
  - `💡 Savings Suggestions` - Obtain actionable ideas to reduce monthly expenditure.
  - `💸 Settle Debts & Balances` - Retrieve a plain-text settlement strategy.
- **Graceful Keys Setup Guide**: Displays an interactive setup screen when `GROQ_API_KEY` is not configured, guiding the user to enter their API keys.

---

## 📱 6. PWA (Progressive Web App) standalone Support

Engineered for native-app feels on Android and iOS:
- **Standalone Mode**: Configured manifests to hide browser chrome and run full-screen.
- **Apple iOS Metatags**: Injected specific meta declarations (e.g., `apple-mobile-web-app-status-bar-style`) to support Safari home screen installations.
- **Custom Icons**: Bundled with 192px and 512px icon masks.

---

## 💬 7. Live WhatsApp Agent Integration

Log transactions directly from actual WhatsApp chats using the Meta Cloud API:
- **Multi-Modal OCR Agent**: Uploading transaction receipts/invoices automatically triggers a backend image downloader (`v23.0` API) and performs a receipt-text extract via Gemini.
- **Text Intent Parser**: Recognizes standard natural sentences (e.g., `"Paid 500 for veggies at DMart"`) or short lazy logs (e.g., `"DMart 500"`).
- **Interactive Typing Indicators**: Sends immediate read receipts and visual typing statuses ("FamBudget is typing...") back to the user within seconds of receipt to show progress.
- **MongoDB Session Confirmation**: Drafts details in a persistent `WhatsAppSessionModel` with auto-expire TTL indices. Sends confirmation prompts back to WhatsApp.
- **Smart Safeguards & AI Cost Minimization**:
  - *Programmatic Command Router (0-AI Cost)* - Directly resolves greetings (`hi`/`help`), weekly/monthly summaries, group spend comparisons, individual spender rankings, category breakdown totals, equal-share outstanding settlements, and custom keyword searches (`search <term>`) locally using MongoDB queries, avoiding Gemini costs entirely.
  - *Duplicate warnings* - Triggers warnings if a user attempts to record the same merchant and amount within a 10-minute window.
  - *Merchant memory* - Scans past transactions to identify categories for known merchants, auto-saving without querying Gemini.
  - *Fail-safe responses* - Sends direct WhatsApp messages if the Gemini API key runs out of prepayment credits, indicating setup links instead of failing silently.

---

## ⏰ 8. Budget Reminders & Cron Job Scheduling

Automation triggers that keep the family ledger up to date without requiring manual checks:
- **Bi-Monthly Automated Cron Jobs**: Configured via `node-cron` aligned to `Asia/Kolkata` timezone:
  - **15th of Every Month at 09:00 AM**: Dispatches the mid-month ledger check-in reminder to all family members to review receipts for the first half of the month.
  - **Last Day of Every Month at 09:00 AM**: Detects the last calendar day (28th-31st) and dispatches the month-end ledger wrap-up reminder before settlements are calculated.
- **Web Push Notifications (Service Worker + VAPID)**: Native device push pop-up alerts delivered directly to Windows Action Center, macOS notification banners, and Android lock screens even when the browser tab is closed.
- **Interactive Notification Center (In-App)**:
  - Header Bell icon with animated unread badge counter.
  - Slide-out glassmorphic notification drawer with 1-click **"➕ Log Expense"** quick action that opens the modal with the logged-in user selected.
  - Push status toggle to easily enable native device notifications.
- **Custom Test Route (`POST /api/notifications/test-cron`)**:
  - Dedicated endpoint to immediately trigger a broadcast push notification and in-app alert to all active users on-demand for instant testing without waiting for the 15th.
