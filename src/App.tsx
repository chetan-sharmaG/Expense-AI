/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DBState, Expense, Settlement, Group, User } from './types';
import DashboardView from './components/DashboardView';
import ExpensesView from './components/ExpensesView';
import SettlementView from './components/SettlementView';
import FamilyView from './components/FamilyView';
import AdvisorView from './components/AdvisorView';
import AnalysisView from './components/AnalysisView';
import NotificationCenter from './components/NotificationCenter';
import { registerServiceWorker } from './utils/pushNotifications';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Receipt, 
  WalletCards, 
  Users2, 
  MessageSquareCode, 
  CircleDot, 
  Layers, 
  Activity,
  Menu,
  X,
  CreditCard,
  LogOut,
  Filter,
  BrainCircuit,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const [dbState, setDbStateRaw] = useState<DBState | null>(() => {
    try {
      const cached = localStorage.getItem('family_funds_db_state');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // State setter wrapper that keeps localStorage cache in sync
  const setDbState = (newState: DBState | null | ((prev: DBState | null) => DBState | null)) => {
    setDbStateRaw((prev) => {
      const updated = typeof newState === 'function' ? newState(prev) : newState;
      if (updated) {
        try {
          localStorage.setItem('family_funds_db_state', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to cache dbState:', e);
        }
      } else {
        localStorage.removeItem('family_funds_db_state');
      }
      return updated;
    });
  };

  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.replace(/^\//, '') || 'dashboard';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [triggerAddExpense, setTriggerAddExpense] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  // Authentication states
  const [userToken, setUserToken] = useState<string | null>(() => localStorage.getItem('family_funds_token'));
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const cached = localStorage.getItem('family_funds_user');
    return cached ? JSON.parse(cached) : null;
  });

  // Auth Form states
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGroupId, setRegGroupId] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');

  // Public dynamic database config states
  const [publicGroups, setPublicGroups] = useState<any[]>([]);

  // Load public groups for registration dropdown
  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const gRes = await fetch('/api/public/groups');
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.success && gData.groups) {
            setPublicGroups(gData.groups);
            // Default select the first group if present
            if (gData.groups.length > 0) {
              setRegGroupId(gData.groups[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load public config info:', err);
      }
    };
    fetchPublicData();
  }, []);

  // Trigger loading state whenever the token is set/valid
  useEffect(() => {
    if (userToken) {
      fetchState();
    }
  }, [userToken]);

  // Scroll to top of the main container when changing tabs
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [location.pathname]);

  // Register Service Worker for Web Push on application startup
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Auth Headers helper with diagnostic logging
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const method = options.method || 'GET';
    const startTime = performance.now();

    // Pretty console logs in browser DevTools
    const bodyPreview = options.body && typeof options.body === 'string'
      ? (options.body.length > 250 ? `${options.body.substring(0, 250)}... [truncated]` : options.body)
      : undefined;

    console.log(`%c[API Request] ${method} ${url}`, 'color: #38bdf8; font-weight: bold;', bodyPreview ? { payload: bodyPreview } : '');

    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${userToken}`
    };

    try {
      const res = await fetch(url, { ...options, headers });
      const duration = Math.round(performance.now() - startTime);
      const isSuccess = res.ok;
      const statusColor = isSuccess ? '#4ade80' : res.status < 500 ? '#f59e0b' : '#ef4444';
      
      console.log(
        `%c[API Response] ${method} ${url} → ${res.status} ${res.statusText} (${duration}ms)`,
        `color: ${statusColor}; font-weight: bold;`
      );
      return res;
    } catch (err: any) {
      const duration = Math.round(performance.now() - startTime);
      console.error(
        `%c[API Error] ${method} ${url} failed after ${duration}ms:`,
        'color: #ef4444; font-weight: bold;',
        err
      );
      throw err;
    }
  };

  const fetchState = async () => {
    if (!userToken) return;
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth('/api/db-state');
      if (res.ok) {
        const data = await res.json();
        setDbState(data);
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      }
    } catch (e) {
      console.error('Failed to parse database state:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = (confirmRequired = false) => {
    if (confirmRequired && !window.confirm("Are you sure you want to log out of FamilyFunds?")) {
      return;
    }
    localStorage.removeItem('family_funds_token');
    localStorage.removeItem('family_funds_user');
    localStorage.removeItem('family_funds_db_state');
    setUserToken(null);
    setCurrentUser(null);
    setDbState(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('family_funds_token', data.token);
        localStorage.setItem('family_funds_user', JSON.stringify(data.user));
        setUserToken(data.token);
        setCurrentUser(data.user);
      } else {
        setLoginError(data.error || 'Login verification failed.');
      }
    } catch (err) {
      setLoginError('Server connection error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          groupId: regGroupId,
          role: 'member',
          whatsappNumber: regWhatsapp || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('family_funds_token', data.token);
        localStorage.setItem('family_funds_user', JSON.stringify(data.user));
        setUserToken(data.token);
        setCurrentUser(data.user);
      } else {
        setLoginError(data.error || 'Registration failed.');
      }
    } catch (err) {
      setLoginError('Server connection error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };


  // Reset database state to premium Sharma Family defaults
  const handleResetSystem = async () => {
    if (!confirm('Are you sure you wish to wipe current inputs and restore default family database defaults? This is irreversible.')) {
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth('/api/db-reset', { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.data);
        navigate('/dashboard');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Reset only expenses and settlements
  const handleResetExpensesOnly = async () => {
    if (!confirm('Are you sure you wish to delete all expenses, settlements, and chat histories? Users and Groups will be preserved. This is irreversible.')) {
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth('/api/db-clean-expenses', { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
        navigate('/dashboard');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Family & Group Management APIs
  const handleAddGroup = async (name: string) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateGroupBudget = async (id: string, budget: number) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/groups/${id}/budget`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyBudget: budget })
      });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/groups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddUser = async (userPayload: { name: string; email: string; groupId: string; role: 'admin' | 'member'; whatsappNumber?: string }) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload)
      });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateUser = async (id: string, updatedPayload: Partial<User>) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload)
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setDbState(body.state);
      } else {
        throw new Error(body.error || 'Failed to update user profile.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Expense Management APIs
  const handleAddExpense = async (expensePayload: Omit<Expense, 'id' | 'groupId' | 'createdAt'>, imageBase64?: string) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expensePayload,
          originalImage: imageBase64
        })
      });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditExpense = async (id: string, updatedPayload: Partial<Expense>) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload)
      });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Receipt OCR backend call
  const handleTriggerOcr = async (base64Image: string) => {
    try {
      const res = await fetchWithAuth('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return data;
      }
      return { error: true, message: data.message || 'OCR analysis failed.' };
    } catch (e: any) {
      console.error('OCR analysis failed:', e);
      return { error: true, message: e.message || 'Network error during OCR analysis.' };
    }
  };

  // WhatsApp emulator helper APIs removed because bot is now integrated

  const handleSendAdvisor = async (text: string) => {
    const res = await fetchWithAuth('/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || 'Failed to communicate with AI Advisor.');
    }
    const updated = await res.json();
    setDbState(updated);
  };

  const handleClearAdvisor = async () => {
    try {
      const res = await fetchWithAuth('/api/ai/advisor/clear', { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setDbState(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 6. Settlement APIs
  const handleAddSettlement = async (payload: Omit<Settlement, 'id' | 'status' | 'date'>) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMarkSettleCompleted = async (id: string) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/settlements/${id}/settle`, { method: 'PUT' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteSettlement = async (id: string) => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/settlements/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Navigation Items
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'analysis', name: 'Analysis', icon: Activity },
    { id: 'expenses', name: 'Family Ledger', icon: Receipt },
    { id: 'settlement', name: 'Settlement Engine', icon: WalletCards },
    { id: 'family', name: 'Family & Groups', icon: Users2 },
    { id: 'advisor', name: 'AI Advisor', icon: BrainCircuit },
  ];

  // Auth Guard
  // Auth Guard
  if (!userToken || !currentUser) {
    return (
      <div className="min-h-screen bg-[#05070d] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Glow background mesh */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-amber-500/10 rounded-full blur-[140px] pointer-events-none animate-aura-glow"></div>
        <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Brand header */}
        <div className="flex items-center gap-3.5 mb-8 relative z-10">
          <div className="size-12 bg-gradient-to-tr from-emerald-400 via-teal-500 to-amber-400 rounded-2xl text-slate-950 shadow-xl shadow-emerald-500/20 flex items-center justify-center font-extrabold font-mono text-2xl glow-pill">
            F
          </div>
          <div>
            <h1 className="font-extrabold text-3xl tracking-tight text-white font-sans gradient-text-aurora animate-text-shimmer">
              FamilyFunds
            </h1>
            <span className="text-[10px] text-emerald-400/80 font-mono tracking-widest uppercase font-semibold block mt-0.5">
              Multi-Group Family Vault
            </span>
          </div>
        </div>

        {/* Auth Box */}
        <div className="glass-card border border-white/10 rounded-3xl p-7 sm:p-9 w-full max-w-md shadow-2xl space-y-6 relative z-10 backdrop-blur-2xl">
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-xl font-extrabold text-white tracking-tight font-sans">
              {isRegisterMode ? 'Onboard Member Profile' : 'Access Family Vault'}
            </h2>
            <p className="text-slate-400 text-xs font-medium">
              {isRegisterMode ? 'Join your family ledger group with secure credentials.' : 'Verify authorization credentials to access live ledgers.'}
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></span>
              {loginError}
            </div>
          )}

          {isRegisterMode ? (
            /* REGISTRATION FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Meera Sharma"
                  className="w-full px-4 py-3 bg-[#080b15]/90 border border-white/10 focus:border-emerald-400 text-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/20 font-medium transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="meera@family.com"
                  className="w-full px-4 py-3 bg-[#080b15]/90 border border-white/10 focus:border-emerald-400 text-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/20 font-medium transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Password</label>
                <input 
                  type="password" 
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#080b15]/90 border border-white/10 focus:border-emerald-400 text-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/20 font-medium font-mono transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Family Group Allocation</label>
                <select
                  required
                  value={regGroupId}
                  onChange={(e) => setRegGroupId(e.target.value)}
                  className="w-full px-4 py-3 bg-[#080b15]/90 border border-white/10 focus:border-emerald-400 text-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/20 font-medium transition-all cursor-pointer"
                >
                  {publicGroups.map(g => (
                    <option key={g.id} value={g.id} className="bg-[#0c0f1d] text-slate-200">{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">WhatsApp Number (Optional)</label>
                <input 
                  type="text" 
                  value={regWhatsapp}
                  onChange={(e) => setRegWhatsapp(e.target.value)}
                  placeholder="e.g. 919876543210"
                  className="w-full px-4 py-3 bg-[#080b15]/90 border border-white/10 focus:border-emerald-400 text-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/20 font-medium transition-all"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-2xl text-xs uppercase tracking-wider font-mono shadow-lg shadow-emerald-500/25 cursor-pointer transition-all disabled:opacity-50 mt-2"
              >
                {authLoading ? 'Creating Profile...' : 'Register Profile'}
              </button>
            </form>
          ) : (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. rahul@family.com"
                  className="w-full px-4 py-3 bg-[#080b15]/90 border border-white/10 focus:border-emerald-400 text-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/20 font-medium transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Password</label>
                <input 
                  type="password" 
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#080b15]/90 border border-white/10 focus:border-emerald-400 text-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/20 font-medium font-mono transition-all"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-2xl text-xs uppercase tracking-wider font-mono shadow-lg shadow-emerald-500/25 cursor-pointer transition-all disabled:opacity-50 mt-2"
              >
                {authLoading ? 'Verifying Credentials...' : 'Access Vault'}
              </button>
            </form>
          )}

          {/* Mode Switcher */}
          <div className="text-center text-xs relative z-10 pt-2 border-t border-white/5">
            <button 
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLoginError('');
              }}
              className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer bg-transparent border-0 outline-none transition-colors"
            >
              {isRegisterMode ? 'Already registered? Log in here' : 'New family member? Onboard profile'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (!dbState) {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="text-center space-y-4 relative z-10">
          <div className="size-14 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto glow-pill" />
          <div>
            <h3 className="text-white font-extrabold font-sans text-lg gradient-text-emerald">FamilyFunds Syncing</h3>
            <p className="text-slate-400 text-xs mt-1 font-mono">Loading records from MongoDB cluster...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 font-sans flex flex-col lg:flex-row relative">
      {/* Background Aurora Mesh Glows */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none animate-aura-glow"></div>
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[140px] pointer-events-none"></div>

      {/* 1. SIDEBAR Navigation rail (Desktop) */}
      <aside className={`bg-[#090c19]/90 text-slate-100 flex-col justify-between shrink-0 border-r border-white/10 backdrop-blur-2xl hidden lg:flex transition-all duration-300 relative z-20 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}`}>
        <div className={`p-6 space-y-8 ${sidebarCollapsed ? 'px-3' : ''}`}>
          
          {/* Brand header */}
          <div className={`flex items-center gap-3 justify-between ${sidebarCollapsed ? 'flex-col items-center' : ''}`}>
            <div 
              onClick={() => navigate('/dashboard')} 
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 bg-gradient-to-tr from-emerald-400 via-teal-500 to-amber-400 rounded-xl text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center justify-center font-extrabold font-mono text-xl shrink-0 group-hover:scale-105 transition-transform glow-pill">
                F
              </div>
              {!sidebarCollapsed && (
                <div className="transition-opacity duration-200">
                  <h2 className="font-extrabold text-xl tracking-tight text-white font-sans gradient-text-aurora animate-text-shimmer">FamilyFunds</h2>
                  <span className="text-[9px] text-emerald-400/80 font-mono tracking-widest uppercase font-semibold mt-0.5 block">Ledger Engine</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !sidebarCollapsed;
                setSidebarCollapsed(next);
                localStorage.setItem('sidebar_collapsed', String(next));
              }}
              className={`p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/30 text-slate-400 hover:text-white transition cursor-pointer flex items-center justify-center shrink-0 ${sidebarCollapsed ? 'mt-2 mx-auto' : 'ml-auto'}`}
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1.5 pt-4">
            {!sidebarCollapsed && (
              <div className="px-3 py-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">Navigation</div>
            )}
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`side-nav-${item.id}`}
                  onClick={() => navigate('/' + item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                    sidebarCollapsed ? 'justify-center px-0' : ''
                  } ${
                    isActive 
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-2 border-emerald-400 font-bold shadow-lg shadow-emerald-500/5' 
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <Icon className={`size-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sync panel on footer */}
        <div className={`p-5 border-t border-white/10 space-y-3.5 bg-[#060812]/90 backdrop-blur-xl transition-all ${sidebarCollapsed ? 'flex flex-col items-center px-2' : ''}`}>
          <div className={`flex items-center justify-between text-[10px] text-slate-400 font-mono font-semibold w-full ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <span className="flex items-center gap-1.5" title={sidebarCollapsed ? (isSyncing ? 'Syncing...' : 'MongoDB Connected') : undefined}>
              <CircleDot className={`size-2.5 ${isSyncing ? 'text-amber-400 animate-ping' : 'text-emerald-400'}`} />
              {!sidebarCollapsed && (isSyncing ? 'Syncing...' : 'MongoDB Connected')}
            </span>
            {!sidebarCollapsed && <span className="text-slate-500">v3.5</span>}
          </div>

          {/* Active member session info & logout */}
          <div className={`text-xs text-slate-300 font-semibold border-t border-white/10 pt-3 flex items-center justify-between gap-1 w-full ${sidebarCollapsed ? 'justify-center border-t-0 pt-0' : ''}`}>
            {!sidebarCollapsed && (
              <span className="truncate">Member: <b className="text-emerald-400 font-bold">{currentUser?.name}</b></span>
            )}
            <button 
              onClick={() => handleLogout(true)}
              className={`text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-0.5 bg-transparent border-0 outline-none p-1.5 rounded-xl hover:bg-rose-500/10 transition-colors ${sidebarCollapsed ? 'w-10 h-10 justify-center border border-rose-500/20' : ''}`}
              title="Logout Profile"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MOBILE Header with sliding drawer trigger */}
      <header className="lg:hidden bg-[#090c19]/90 backdrop-blur-xl text-white p-4 flex items-center justify-between border-b border-white/10 shrink-0 relative z-30">
        <div 
          onClick={() => navigate('/dashboard')} 
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="size-9 bg-gradient-to-tr from-emerald-400 via-teal-500 to-amber-400 rounded-xl text-slate-950 flex items-center justify-center font-extrabold text-sm font-mono glow-pill">
            F
          </div>
          <h2 className="font-extrabold text-base tracking-tight text-white font-sans gradient-text-aurora">FamilyFunds</h2>
        </div>

        <div className="flex items-center gap-2">
          <NotificationCenter
            notifications={dbState?.notifications || []}
            authToken={userToken || ''}
            onRefreshState={fetchState}
            onTriggerAddExpense={() => {
              navigate('/expenses');
              setTriggerAddExpense(true);
            }}
          />
          <button
            onClick={fetchState}
            disabled={isSyncing}
            className={`p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 transition-all flex items-center justify-center cursor-pointer ${isSyncing ? 'animate-spin opacity-50' : ''}`}
            title="Refresh"
          >
            <RefreshCw className="size-4" />
          </button>
          <button
            onClick={() => {
              navigate('/expenses');
              setTriggerAddExpense(true);
            }}
            className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 rounded-xl text-xs font-bold font-mono transition flex items-center gap-1 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Plus className="size-4" />
            <span>Add</span>
          </button>
          
          <button 
            type="button"
            id="btn-mobile-menu"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 hover:bg-white/5 rounded-xl cursor-pointer flex items-center justify-center text-slate-300 hover:text-white border border-white/10"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {/* Mobile Glass Backdrop & Sliding Drawer Sidebar */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 transition-opacity duration-300 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Sliding sidebar panel */}
          <aside className="fixed inset-y-0 left-0 w-72 bg-[#090c19] border-r border-white/10 z-55 flex flex-col justify-between shadow-2xl animate-slide-in lg:hidden backdrop-blur-2xl">
            <div className="p-5 space-y-6">
              
              {/* Drawer header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 bg-gradient-to-tr from-emerald-400 via-teal-500 to-amber-400 rounded-xl text-slate-950 flex items-center justify-center font-extrabold text-sm font-mono glow-pill">
                    F
                  </div>
                  <h2 className="font-extrabold text-base tracking-wide text-white font-sans gradient-text-aurora">FamilyFunds</h2>
                </div>
                <button 
                  type="button" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Navigation list */}
              <nav className="space-y-1.5">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`mobile-nav-${item.id}`}
                      onClick={() => {
                        navigate('/' + item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-2 border-emerald-400 font-bold' 
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`size-5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sync & account controls on bottom */}
            <div className="p-5 border-t border-white/10 space-y-3.5 bg-[#060812]">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold font-mono">
                <span className="flex items-center gap-1.5">
                  <CircleDot className={`size-2.5 ${isSyncing ? 'text-amber-400 animate-ping' : 'text-emerald-400'}`} />
                  {isSyncing ? 'Syncing...' : 'Connected'}
                </span>
                <span>v3.5</span>
              </div>
              
              <div className="text-xs text-slate-300 font-semibold border-t border-white/10 pt-3 flex items-center justify-between gap-1">
                <span className="truncate">Member: <b className="text-emerald-400 font-bold">{currentUser?.name}</b></span>
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout(true);
                  }}
                  className="text-rose-400 hover:text-rose-300 p-1 flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none"
                  title="Logout Profile"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* 3. MAIN Panel display canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Sleek Top Header Bar (Desktop & Tablet) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-5 border-b border-white/10 bg-[#090c19]/70 backdrop-blur-2xl shrink-0">
          <div>
            <h1 className="text-2xl font-extrabold text-white capitalize tracking-tight font-sans">
              {activeTab === 'expenses' ? 'Family Ledger' : activeTab === 'settlement' ? 'Settlement Engine' : activeTab === 'family' ? 'Family & Groups' : activeTab}
            </h1>
            <p className="text-xs text-slate-400 font-medium">Manage and review your family ledger operations</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter
              notifications={dbState?.notifications || []}
              authToken={userToken || ''}
              onRefreshState={fetchState}
              onTriggerAddExpense={() => {
                navigate('/expenses');
                setTriggerAddExpense(true);
              }}
            />
            <button
              onClick={fetchState}
              disabled={isSyncing}
              className={`p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all flex items-center justify-center cursor-pointer ${isSyncing ? 'animate-spin opacity-50' : ''}`}
              title="Refresh database data"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              onClick={() => {
                navigate('/expenses');
                setTriggerAddExpense(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-2xl text-xs uppercase tracking-wider font-mono shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
            >
              <Plus className="size-4 stroke-[3]" />
              <span>Log Expense</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full custom-scrollbar">
          
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route 
                path="/" 
                element={<Navigate to="/dashboard" replace />} 
              />
              <Route 
                path="/dashboard" 
                element={
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <DashboardView 
                      state={dbState} 
                      onNavigate={(id, stateData) => navigate(`/${id}`, { state: stateData })} 
                    />
                  </motion.div>
                } 
              />
              <Route 
                path="/analysis" 
                element={
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <AnalysisView 
                      state={dbState} 
                    />
                  </motion.div>
                } 
              />
              <Route 
                path="/expenses" 
                element={
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <ExpensesView 
                      state={dbState}
                      currentUser={currentUser}
                      onAddExpense={handleAddExpense}
                      onEditExpense={handleEditExpense}
                      onDeleteExpense={handleDeleteExpense}
                      onTriggerOcr={handleTriggerOcr}
                      isSyncing={isSyncing}
                      triggerAddExpense={triggerAddExpense}
                      onTriggerAddExpenseProcessed={() => setTriggerAddExpense(false)}
                    />
                  </motion.div>
                } 
              />
              <Route 
                path="/settlement" 
                element={
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <SettlementView 
                      state={dbState}
                      onAddSettlement={handleAddSettlement}
                      onMarkSettleCompleted={handleMarkSettleCompleted}
                      onDeleteSettlement={handleDeleteSettlement}
                      isSyncing={isSyncing}
                    />
                  </motion.div>
                } 
              />
              <Route 
                path="/family" 
                element={
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <FamilyView 
                      state={dbState}
                      onAddGroup={handleAddGroup}
                      onDeleteGroup={handleDeleteGroup}
                      onUpdateGroupBudget={handleUpdateGroupBudget}
                      onAddUser={handleAddUser}
                      onDeleteUser={handleDeleteUser}
                      onUpdateUser={handleUpdateUser}
                      isSyncing={isSyncing}
                    />
                  </motion.div>
                } 
              />
              <Route 
                path="/advisor" 
                element={
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <AdvisorView 
                      state={dbState}
                      onSendAdvisor={handleSendAdvisor}
                      onClearAdvisor={handleClearAdvisor}
                    />
                  </motion.div>
                } 
              />
              <Route 
                path="*" 
                element={<Navigate to="/dashboard" replace />} 
              />
            </Routes>
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
