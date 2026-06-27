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
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  Receipt, 
  WalletCards, 
  Users2, 
  MessageSquareCode, 
  RotateCcw, 
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
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [dbState, setDbState] = useState<DBState | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.replace(/^\//, '') || 'dashboard';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [triggerAddExpense, setTriggerAddExpense] = useState(false);

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

  // Auth Headers helper
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${userToken}`
    };
    return fetch(url, { ...options, headers });
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

  const handleLogout = () => {
    localStorage.removeItem('family_funds_token');
    localStorage.removeItem('family_funds_user');
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
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('OCR analysis failed:', e);
    }
    return null;
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
  if (!userToken || !currentUser) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-tr from-emerald-500/10 to-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Brand header */}
        <div className="flex items-center gap-3 mb-8 relative z-10 animate-fade-in">
          <div className="size-11 bg-gradient-to-tr from-emerald-500 to-teal-650 rounded-xl text-white shadow-lg shadow-emerald-950/20 flex items-center justify-center font-bold font-mono text-xl">
            F
          </div>
          <div>
            <h1 className="font-bold text-2xl tracking-tight text-white font-sans">FamilyFunds</h1>
            <span className="text-[9px] text-slate-500 font-extrabold tracking-widest uppercase font-mono block mt-0.5">Secure Ledger Vault</span>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-[#0f121d]/80 border border-white/5 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6 relative z-10 backdrop-blur-xl">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Sharma Family Vault</h2>
            <p className="text-slate-400 text-xs font-semibold">Verify credentials or onboard a new member profile.</p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-450 text-xs font-semibold rounded-xl flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
              {loginError}
            </div>
          )}

          {isRegisterMode ? (
            /* REGISTRATION FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 font-mono">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Aunt Meera"
                  className="w-full px-3.5 py-2.5 bg-[#080a11] border border-white/5 focus:border-emerald-500 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 font-mono">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="meera@family.com"
                  className="w-full px-3.5 py-2.5 bg-[#080a11] border border-white/5 focus:border-emerald-500 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 font-mono">Password</label>
                <input 
                  type="password" 
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-[#080a11] border border-white/5 focus:border-emerald-500 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold font-mono transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 font-mono">Family Group Allocation</label>
                <select
                  required
                  value={regGroupId}
                  onChange={(e) => setRegGroupId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#080a11] border border-white/5 focus:border-emerald-500 text-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold transition-all"
                >
                  {publicGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 font-mono">WhatsApp Number (Optional)</label>
                <input 
                  type="text" 
                  value={regWhatsapp}
                  onChange={(e) => setRegWhatsapp(e.target.value)}
                  placeholder="e.g. 919876543210 (with country code)"
                  className="w-full px-3.5 py-2.5 bg-[#080a11] border border-white/5 focus:border-emerald-500 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold transition-all"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/20 cursor-pointer transition disabled:opacity-50"
              >
                {authLoading ? 'Creating profile...' : 'Register Profile'}
              </button>
            </form>
          ) : (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 font-mono">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. rahul@family.com"
                  className="w-full px-3.5 py-2.5 bg-[#080a11] border border-white/5 focus:border-emerald-500 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 font-mono">Password</label>
                <input 
                  type="password" 
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-[#080a11] border border-white/5 focus:border-emerald-500 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold font-mono transition-all"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/20 cursor-pointer transition disabled:opacity-50"
              >
                {authLoading ? 'Verifying credentials...' : 'Access Vault'}
              </button>
            </form>
          )}

          {/* Mode Switcher */}
          <div className="text-center text-xs relative z-10 pt-2">
            <button 
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLoginError('');
              }}
              className="text-emerald-450 hover:text-emerald-350 hover:underline font-bold cursor-pointer bg-transparent border-0 outline-none"
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
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="size-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>
            <h3 className="text-white font-bold font-sans text-base">FamilyFunds Loading</h3>
            <p className="text-slate-500 text-xs mt-1 font-semibold">Retrieving Sharma Family records from MongoDB...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col lg:flex-row">
      
      {/* 1. SIDEBAR Navigation rail (Desktop) */}
      <aside className="w-full lg:w-72 bg-[#0d101d] text-slate-100 flex-col justify-between shrink-0 border-r border-white/5 hidden lg:flex">
        <div className="p-6 space-y-8">
          
          {/* Brand header */}
          <div 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-500 to-teal-650 rounded-lg text-white shadow-lg flex items-center justify-center font-bold font-mono">
              F
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-tight text-white font-sans">FamilyFunds</h2>
              <span className="text-[9px] text-slate-500 font-extrabold tracking-widest uppercase font-mono mt-0.5">Sharma family ledger</span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1.5 pt-4">
            <div className="px-3 py-2 text-[9px] font-extrabold text-slate-500 uppercase tracking-widest font-mono mb-2">Main Menu</div>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`side-nav-${item.id}`}
                  onClick={() => navigate('/' + item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium tracking-wide transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-emerald-950/30 text-emerald-450 border-l-2 border-emerald-500 font-bold shadow-inner' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="size-4.5 shrink-0" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sync panel on footer */}
        <div className="p-6 border-t border-white/5 space-y-3.5 bg-[#090b11]/80">
          <div className="flex items-center justify-between text-[10px] text-slate-550 font-mono font-bold">
            <span className="flex items-center gap-1.5">
              <CircleDot className={`size-2.5 ${isSyncing ? 'text-amber-500 animate-ping' : 'text-emerald-505'}`} />
              {isSyncing ? 'Syncing...' : 'MongoDB Connected'}
            </span>
            <span className="text-slate-600">V3.5</span>
          </div>

          {/* Active member session info & logout */}
          <div className="text-xs text-slate-400 font-semibold border-t border-white/5 pt-2.5 flex items-center justify-between gap-1">
            <span className="truncate">Logged as: <b className="text-emerald-400 font-bold">{currentUser?.name}</b></span>
            <button 
              onClick={handleLogout}
              className="text-rose-400 hover:text-rose-350 cursor-pointer flex items-center gap-0.5 bg-transparent border-0 outline-none p-1 rounded transition-colors"
              title="Logout Profile"
            >
              <LogOut className="size-4" />
            </button>
          </div>

          <button
            type="button"
            id="btn-factory-reset"
            onClick={handleResetSystem}
            className="w-full py-2 bg-white/5 hover:bg-rose-955/20 hover:text-rose-400 text-slate-450 rounded-xl transition border border-white/5 text-[10px] font-bold cursor-pointer mb-2"
          >
            <RotateCcw className="size-3 inline mr-1" />
            Reset Family Default
          </button>

          <button
            type="button"
            id="btn-reset-expenses"
            onClick={handleResetExpensesOnly}
            className="w-full py-2 bg-white/5 hover:bg-rose-955/20 hover:text-rose-400 text-slate-450 rounded-xl transition border border-white/5 text-[10px] font-bold cursor-pointer"
          >
            <RotateCcw className="size-3 inline mr-1" />
            Reset Expenses Only
          </button>
        </div>
      </aside>

      {/* 2. MOBILE Header with burger toggle drawer */}
      <header className="lg:hidden bg-[#090b11] text-white p-4 flex items-center justify-between border-b border-white/5 shrink-0">
        <div 
          onClick={() => navigate('/dashboard')} 
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="size-8 bg-gradient-to-tr from-emerald-500 to-teal-650 rounded-lg text-white flex items-center justify-center font-bold text-xs">
            F
          </div>
          <h2 className="font-bold text-sm tracking-wide text-slate-100">FamilyFunds</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchState}
            disabled={isSyncing}
            className={`p-1.5 bg-white/5 hover:bg-white/10 text-slate-355 hover:text-white rounded-lg border border-white/5 transition-all flex items-center justify-center cursor-pointer ${isSyncing ? 'animate-spin opacity-50' : ''}`}
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            onClick={() => {
              navigate('/expenses');
              setTriggerAddExpense(true);
            }}
            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-650 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="text-slate-450 hover:text-rose-455 p-1 flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none text-xs font-semibold transition-colors"
            title="Log Out"
          >
            <LogOut className="size-4" />
          </button>
          <button 
            type="button"
            id="btn-mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 hover:bg-slate-855 rounded-md cursor-pointer"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer drawer container */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0d101d] border-b border-white/5 z-45 flex flex-col p-4 space-y-4 animate-fade-in relative shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`mobile-nav-${item.id}`}
                  onClick={() => {
                    navigate('/' + item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-semibold ${
                    activeTab === item.id 
                      ? 'bg-emerald-600 text-white font-bold' 
                      : 'bg-white/5 text-slate-350 hover:text-white'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {item.name}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold font-mono">
              <span>User: {currentUser?.name}</span>
            </div>
            <div className="flex justify-between items-center gap-2 pt-1 border-t border-white/5">
              <button
                type="button"
                id="btn-mobile-reset"
                onClick={() => {
                  handleResetSystem();
                  setMobileMenuOpen(false);
                }}
                className="text-[10px] text-rose-400 hover:underline cursor-pointer font-bold bg-transparent border-0 p-0"
              >
                Reset Database default
              </button>
              <button
                type="button"
                id="btn-mobile-reset-expenses"
                onClick={() => {
                  handleResetExpensesOnly();
                  setMobileMenuOpen(false);
                }}
                className="text-[10px] text-rose-400 hover:underline cursor-pointer font-bold bg-transparent border-0 p-0"
              >
                Reset Expenses Only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN Panel display canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sleek Top Header Bar (Desktop & Tablet) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#090b11]/80 backdrop-blur-md shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white capitalize tracking-tight font-sans">
              {activeTab === 'expenses' ? 'Family Ledger' : activeTab === 'settlement' ? 'Settlement Engine' : activeTab === 'family' ? 'Family & Groups' : activeTab}
            </h1>
            <p className="text-xs text-slate-500 font-medium">Manage and review your family ledger operations</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchState}
              disabled={isSyncing}
              className={`p-2 bg-white/5 hover:bg-white/10 text-slate-355 hover:text-white rounded-xl border border-white/5 transition-all flex items-center justify-center cursor-pointer ${isSyncing ? 'animate-spin opacity-50' : ''}`}
              title="Refresh database data"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              onClick={() => {
                navigateToTab('expenses');
                setTriggerAddExpense(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Log Expense</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full custom-scrollbar">
          
          <Routes>
            <Route 
              path="/" 
              element={<Navigate to="/dashboard" replace />} 
            />
            <Route 
              path="/dashboard" 
              element={
                <DashboardView 
                  state={dbState} 
                  onNavigate={(id) => navigate(`/${id}`)} 
                />
              } 
            />
            <Route 
              path="/analysis" 
              element={
                <AnalysisView 
                  state={dbState} 
                />
              } 
            />
            <Route 
              path="/expenses" 
              element={
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
              } 
            />
            <Route 
              path="/settlement" 
              element={
                <SettlementView 
                  state={dbState}
                  onAddSettlement={handleAddSettlement}
                  onMarkSettleCompleted={handleMarkSettleCompleted}
                  onDeleteSettlement={handleDeleteSettlement}
                  isSyncing={isSyncing}
                />
              } 
            />
            <Route 
              path="/family" 
              element={
                <FamilyView 
                  state={dbState}
                  onAddGroup={handleAddGroup}
                  onDeleteGroup={handleDeleteGroup}
                  onAddUser={handleAddUser}
                  onDeleteUser={handleDeleteUser}
                  onUpdateUser={handleUpdateUser}
                  isSyncing={isSyncing}
                />
              } 
            />
            <Route 
              path="/advisor" 
              element={
                <AdvisorView 
                  state={dbState}
                  onSendAdvisor={handleSendAdvisor}
                  onClearAdvisor={handleClearAdvisor}
                />
              } 
            />
            <Route 
              path="*" 
              element={<Navigate to="/dashboard" replace />} 
            />
          </Routes>

        </main>
      </div>
    </div>
  );
}
