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
import WhatsAppBotView from './components/WhatsAppBotView';
import AdvisorView from './components/AdvisorView';
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
  BrainCircuit
} from 'lucide-react';

export default function App() {
  const [dbState, setDbState] = useState<DBState | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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


  // Reset database state to premium Mehta Family defaults
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
        setActiveTab('dashboard');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Family & Group Management APIs
  const handleAddGroup = async (name: string) => {
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
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/groups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddUser = async (userPayload: { name: string; email: string; groupId: string; role: 'admin' | 'member'; whatsappNumber?: string }) => {
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
    }
  };

  const handleUpdateUser = async (id: string, updatedPayload: Partial<User>) => {
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
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 3. Expense Management APIs
  const handleAddExpense = async (expensePayload: Omit<Expense, 'id' | 'groupId' | 'createdAt'>, imageBase64?: string) => {
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
    }
  };

  const handleEditExpense = async (id: string, updatedPayload: Partial<Expense>) => {
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
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
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

  // 4. WhatsApp Chat APIs
  const handleSendWhatsApp = async (text: string, base64Image?: string, senderName?: string) => {
    try {
      const res = await fetchWithAuth('/api/whatsapp/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, base64Image, senderName })
      });
      if (res.ok) {
        const updated = await res.json();
        setDbState(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearWhatsApp = async () => {
    try {
      const res = await fetchWithAuth('/api/whatsapp/clear', { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setDbState(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

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
    }
  };

  const handleMarkSettleCompleted = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/settlements/${id}/settle`, { method: 'PUT' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSettlement = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/settlements/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setDbState(body.state);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Navigation Items
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'expenses', name: 'Family Ledger', icon: Receipt },
    { id: 'settlement', name: 'Settlement Engine', icon: WalletCards },
    { id: 'family', name: 'Family & Groups', icon: Users2 },
    { id: 'advisor', name: 'AI Advisor', icon: BrainCircuit },
    { id: 'whatsapp', name: 'WhatsApp Bot', icon: MessageSquareCode },
  ];

  // Auth Guard
  if (!userToken || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        {/* Brand header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 bg-indigo-600 rounded-xl text-white shadow-lg flex items-center justify-center font-bold font-mono text-lg">
            F
          </div>
          <div>
            <h1 className="font-bold text-2xl tracking-tight text-white font-sans">FamilyFunds</h1>
            <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Secure Ledger Vault</span>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full opacity-5 blur-3xl"></div>
          
          <div className="space-y-1 relative z-10">
            <h2 className="text-xl font-bold text-white tracking-tight">Mehta Family Vault</h2>
            <p className="text-slate-400 text-xs font-medium">Verify credentials or select quick-login for verification.</p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/30 text-rose-450 text-xs font-semibold rounded-xl flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 animate-ping"></span>
              {loginError}
            </div>
          )}

          {isRegisterMode ? (
            /* REGISTRATION FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-4 relative z-10">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Aunt Meera"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 text-slate-150 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="meera@family.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 text-slate-150 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Password</label>
                <input 
                  type="password" 
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 text-slate-150 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-semibold font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Family Group Allocation</label>
                <select
                  required
                  value={regGroupId}
                  onChange={(e) => setRegGroupId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 text-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  {publicGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">WhatsApp Number (Optional)</label>
                <input 
                  type="text" 
                  value={regWhatsapp}
                  onChange={(e) => setRegWhatsapp(e.target.value)}
                  placeholder="e.g. 919876543210 (with country code)"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 text-slate-150 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-755 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-650/20 cursor-pointer transition disabled:opacity-50"
              >
                {authLoading ? 'Creating profile...' : 'Register Profile'}
              </button>
            </form>
          ) : (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4 relative z-10">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. rahul@family.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 text-slate-150 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Password</label>
                <input 
                  type="password" 
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 text-slate-150 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-semibold font-mono"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-650/20 cursor-pointer transition disabled:opacity-50"
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
              className="text-indigo-400 hover:underline font-bold cursor-pointer bg-transparent border-0 outline-none"
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="size-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>
            <h3 className="text-slate-100 font-bold font-sans text-base">FamilyFunds Loading</h3>
            <p className="text-slate-500 text-xs mt-1">Retrieving Mehta Family records from MongoDB...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col lg:flex-row">
      
      {/* 1. SIDEBAR Navigation rail (Desktop) */}
      <aside className="w-full lg:w-72 bg-slate-900 text-slate-100 flex-col justify-between shrink-0 border-r border-slate-800 hidden lg:flex">
        <div className="p-6 space-y-8">
          
          {/* Brand header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-650 rounded-lg text-white shadow-lg flex items-center justify-center font-bold font-mono">
              F
            </div>
            <div>
              <h2 className="font-semibold text-lg tracking-tight text-white font-sans">FamilyFunds</h2>
              <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Mehta family ledger</span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1 pt-4">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Main Menu</div>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`side-nav-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium tracking-wide transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-slate-800 text-indigo-400 border-l-4 border-indigo-500 font-semibold' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
        <div className="p-6 border-t border-slate-800 space-y-3.5 bg-slate-950">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono font-medium">
            <span className="flex items-center gap-1">
              <CircleDot className={`size-2 ${isSyncing ? 'text-amber-500 animate-ping' : 'text-green-500'}`} />
              {isSyncing ? 'Syncing...' : 'MongoDB Connected'}
            </span>
            <span>V3.0</span>
          </div>

          {/* Active member session info & logout */}
          <div className="text-xs text-slate-400 font-semibold border-t border-slate-850 pt-2.5 flex items-center justify-between gap-1">
            <span className="truncate">Logged as: <b className="text-indigo-400 font-bold">{currentUser?.name}</b></span>
            <button 
              onClick={handleLogout}
              className="text-rose-450 hover:text-rose-400 cursor-pointer flex items-center gap-0.5 bg-transparent border-0 outline-none p-1 rounded transition-colors"
              title="Logout Profile"
            >
              <LogOut className="size-4" />
            </button>
          </div>

          <button
            type="button"
            id="btn-factory-reset"
            onClick={handleResetSystem}
            className="w-full py-2 bg-slate-900 hover:bg-red-955/30 hover:text-red-400 text-slate-450 rounded-xl transition border border-slate-800 text-[10px] font-bold cursor-pointer"
          >
            <RotateCcw className="size-3 inline mr-1" />
            Reset Family Factory Default
          </button>
        </div>
      </aside>

      {/* 2. MOBILE Header with burger toggle drawer */}
      <header className="lg:hidden bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 bg-indigo-650 rounded-lg text-white flex items-center justify-center font-bold text-xs">
            F
          </div>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-100">FamilyFunds</h2>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleLogout}
            className="text-slate-450 hover:text-rose-400 p-1 flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none text-xs font-semibold transition-colors"
            title="Log Out"
          >
            <LogOut className="size-4" />
          </button>
          <button 
            type="button"
            id="btn-mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 hover:bg-slate-850 rounded-md cursor-pointer"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer drawer container */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 z-45 flex flex-col p-4 space-y-4 animate-fade-in relative shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`mobile-nav-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-semibold ${
                    activeTab === item.id 
                      ? 'bg-indigo-600 text-white font-semibold' 
                      : 'bg-slate-850 text-slate-350 hover:text-white'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {item.name}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between gap-1.5 items-center">
            <button
              type="button"
              id="btn-mobile-reset"
              onClick={() => {
                handleResetSystem();
                setMobileMenuOpen(false);
              }}
              className="text-[10px] text-rose-400 hover:underline cursor-pointer"
            >
              Factory defaults reset
            </button>
            <span className="text-[10px] text-slate-400 font-semibold truncate">User: {currentUser?.name}</span>
          </div>
        </div>
      )}

      {/* 3. MAIN Panel display canvas */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full custom-scrollbar">
        
        {/* Render toggle mapping */}
        {activeTab === 'dashboard' && (
          <DashboardView 
            state={dbState} 
            onNavigate={(id) => setActiveTab(id)} 
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView 
            state={dbState}
            onAddExpense={handleAddExpense}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
            onTriggerOcr={handleTriggerOcr}
          />
        )}

        {activeTab === 'settlement' && (
          <SettlementView 
            state={dbState}
            onAddSettlement={handleAddSettlement}
            onMarkSettleCompleted={handleMarkSettleCompleted}
            onDeleteSettlement={handleDeleteSettlement}
          />
        )}

        {activeTab === 'family' && (
          <FamilyView 
            state={dbState}
            onAddGroup={handleAddGroup}
            onDeleteGroup={handleDeleteGroup}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onUpdateUser={handleUpdateUser}
          />
        )}

        {activeTab === 'whatsapp' && (
          <WhatsAppBotView 
            state={dbState}
            onSendWhatsApp={handleSendWhatsApp}
            onClearWhatsApp={handleClearWhatsApp}
          />
        )}

        {activeTab === 'advisor' && (
          <AdvisorView 
            state={dbState}
            onSendAdvisor={handleSendAdvisor}
            onClearAdvisor={handleClearAdvisor}
          />
        )}

      </main>

    </div>
  );
}
