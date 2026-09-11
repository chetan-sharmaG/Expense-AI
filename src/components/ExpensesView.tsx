/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DBState, Expense, User } from '../types';
import { 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Calendar, 
  DollarSign, 
  FileText, 
  Store, 
  Tag, 
  MoreVertical,
  CheckCircle,
  FileSearch,
  UploadCloud
} from 'lucide-react';

interface ExpensesViewProps {
  state: DBState;
  currentUser?: any;
  onAddExpense: (exp: Omit<Expense, 'id' | 'groupId' | 'createdAt'>, imageBase64?: string) => Promise<void>;
  onEditExpense: (id: string, updated: Partial<Expense>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onTriggerOcr: (base64Image: string) => Promise<any>;
  isSyncing: boolean;
  triggerAddExpense?: boolean;
  onTriggerAddExpenseProcessed?: () => void;
}

const CATEGORIES = [
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

export default function ExpensesView({ 
  state, 
  currentUser,
  onAddExpense, 
  onEditExpense, 
  onDeleteExpense,
  onTriggerOcr,
  isSyncing,
  triggerAddExpense,
  onTriggerAddExpenseProcessed
}: ExpensesViewProps) {
  const { expenses, users, groups } = state;

  const location = useLocation();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => location.state?.initialCategory || '');
  const [selectedPaidBy, setSelectedPaidBy] = useState(() => location.state?.initialPaidBy || '');
  const [selectedGroup, setSelectedGroup] = useState(() => location.state?.initialGroup || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected Month Billing Period Filter
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (location.state?.initialMonth) {
      return location.state.initialMonth;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Keep filters in sync if location state changes
  useEffect(() => {
    if (location.state?.initialCategory !== undefined) {
      setSelectedCategory(location.state.initialCategory);
    }
    if (location.state?.initialGroup !== undefined) {
      setSelectedGroup(location.state.initialGroup);
    }
    if (location.state?.initialPaidBy !== undefined) {
      setSelectedPaidBy(location.state.initialPaidBy);
    }
    if (location.state?.initialMonth !== undefined) {
      setSelectedMonth(location.state.initialMonth);
    }
  }, [location.state]);

  // Calculate unique months available for dropdown options
  const monthOptions = useMemo(() => {
    const monthsSet = new Set<string>();
    expenses.forEach(exp => {
      if (exp.date && exp.date.length >= 7) {
        monthsSet.add(exp.date.slice(0, 7));
      }
    });
    // Ensure current month is represented
    const now = new Date();
    monthsSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  // Format month YYYY-MM label to friendly string (e.g. "June 2026")
  const formatMonthLabel = (ym: string) => {
    const [year, month] = ym.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
    return dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Format logged at time nicely (e.g., "30 Jun, 11:12 AM")
  const formatLoggedTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
  };

  // Scroll to top when this component is rendered/mounted
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, []);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  // Form states
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Groceries');
  const [formPaidBy, setFormPaidBy] = useState(users[0]?.id || '');
  const [formMerchant, setFormMerchant] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formImage, setFormImage] = useState<string | null>(null);

  // OCR Loading state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');

  // Reset Form
  const resetForm = () => {
    setFormAmount('');
    setFormCategory('Groceries');
    setFormPaidBy(users[0]?.id || '');
    setFormMerchant('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormImage(null);
    setOcrSuccessMsg('');
  };

  // Open Create
  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  // Handle Quick Add trigger from parent
  useEffect(() => {
    if (triggerAddExpense) {
      handleOpenCreate();
      onTriggerAddExpenseProcessed?.();
    }
  }, [triggerAddExpense, onTriggerAddExpenseProcessed]);

  // Open Edit
  const handleOpenEdit = (exp: Expense) => {
    setSelectedExpense(exp);
    setFormAmount(String(exp.amount));
    setFormCategory(exp.category);
    setFormPaidBy(exp.paidBy);
    setFormMerchant(exp.merchant);
    setFormDate(exp.date);
    setFormNotes(exp.notes);
    setFormImage(exp.originalImage || null);
    setIsEditOpen(true);
  };

  // Handle Form Submit (Create)
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || Number(formAmount) <= 0 || !formPaidBy || !formDate) {
      alert('Please fill in amount, paid by, and valid date.');
      return;
    }

    await onAddExpense({
      amount: Number(formAmount),
      category: formCategory,
      paidBy: formPaidBy,
      date: formDate,
      merchant: formMerchant || 'Unknown Merchant',
      notes: formNotes
    }, formImage || undefined);

    setIsCreateOpen(false);
    resetForm();
  };

  // Handle Form Submit (Update)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;

    if (!formAmount || Number(formAmount) <= 0 || !formPaidBy || !formDate) {
      alert('Please fill in amount, paid by and date.');
      return;
    }

    await onEditExpense(selectedExpense.id, {
      amount: Number(formAmount),
      category: formCategory,
      paidBy: formPaidBy,
      date: formDate,
      merchant: formMerchant || 'Unknown Merchant',
      notes: formNotes
    });

    setIsEditOpen(false);
    setSelectedExpense(null);
  };

  // Handle receipt image files directly inside the creation dialog! (Extremely premium integration)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setFormImage(base64);
      
      // Instantly offer to scan this image with OCR!
      setOcrLoading(true);
      setOcrSuccessMsg('AI is analyzing the transaction screenshot...');
      try {
        const result = await onTriggerOcr(base64);
        if (result && result.extracted) {
          const { amount, merchant, date, category, notes } = result.extracted;
          if (amount) setFormAmount(String(amount));
          if (merchant) setFormMerchant(merchant);
          if (date) setFormDate(date);
          if (category) {
            // Find matched or category from array or fallback
            const matched = CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase()) || 'Others';
            setFormCategory(matched);
          }
          if (notes) setFormNotes(notes);
          setOcrSuccessMsg('🚀 Gemini AI successfully extracted transaction data!');
        } else {
          setOcrSuccessMsg('Could not read details clearly. Please fill details manually or retry.');
        }
      } catch (err) {
        console.error(err);
        setOcrSuccessMsg('Failed to read image with AI. Please fill details manually.');
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Filter & Search Expenses Algorithm
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // 1. Search filter
      const matchesSearch = 
        exp.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        exp.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. Category filter
      const matchesCategory = !selectedCategory || exp.category === selectedCategory;

      // 3. User paid filter
      const matchesUser = !selectedPaidBy || exp.paidBy === selectedPaidBy;

      // 4. Group filter
      const matchesGroup = !selectedGroup || exp.groupId === selectedGroup;

      // 5. Date filter
      const matchesFrom = !dateFrom || exp.date >= dateFrom;
      const matchesTo = !dateTo || exp.date <= dateTo;

      // 6. Billing Month filter
      const matchesMonth = selectedMonth === 'overall' || (exp.date && exp.date.startsWith(selectedMonth));

      return matchesSearch && matchesCategory && matchesUser && matchesGroup && matchesFrom && matchesTo && matchesMonth;
    }).sort((a, b) => b.date.localeCompare(a.date)); // Sort newest date first
  }, [expenses, searchTerm, selectedCategory, selectedPaidBy, selectedGroup, dateFrom, dateTo, selectedMonth]);

  // Clear all filters helper
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedPaidBy('');
    setSelectedGroup('');
    setDateFrom('');
    setDateTo('');
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-6">
       {/* Search and Filters Header block */}
      <div className="glass-card p-6 rounded-3xl space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-white font-extrabold font-sans text-xl gradient-text-aurora">Family Ledger Entries</h2>
            <p className="text-slate-300 text-xs mt-1 font-medium">Filter, search, audit and manually record joint expenditures.</p>
          </div>
          
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button 
              type="button" 
              id="btn-toggle-filters-mobile"
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-2xl text-xs font-bold font-mono flex items-center justify-center gap-2 cursor-pointer md:hidden"
            >
              <Filter className="size-4" />
              {showFiltersMobile ? 'Hide Filters' : 'Show Filters'}
            </button>
            
            <button 
              type="button" 
              id="btn-add-expense-modal"
              onClick={handleOpenCreate}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-2xl transition-all text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 shrink-0 hover:scale-[1.02]"
            >
              <Plus className="size-4 stroke-[3]" />
              Add Expense Receipt
            </button>
          </div>
        </div>

        {/* Collapsible Filter panel wrapper */}
        <div className={`${showFiltersMobile ? 'block' : 'hidden'} md:block space-y-4`}>
          {/* Filters Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2">
            {/* Search text input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Search className="size-4" />
              </span>
              <input 
                type="text" 
                id="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search merchant..."
                className="w-full pl-10 pr-3 py-2.5 text-xs bg-[#080b15] border border-white/10 text-slate-100 placeholder-slate-500 rounded-xl focus:outline-none focus:border-emerald-400 font-medium"
              />
            </div>

            {/* Category selection */}
            <div>
              <select
                id="filter-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#080b15] border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 font-medium text-slate-200 cursor-pointer"
              >
                <option value="">Categories (All)</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="bg-[#0c0f1d] text-white">{cat}</option>
                ))}
              </select>
            </div>

            {/* Paid By selection */}
            <div>
              <select
                id="filter-paid-by"
                value={selectedPaidBy}
                onChange={(e) => setSelectedPaidBy(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#080b15] border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 font-medium text-slate-200 cursor-pointer"
              >
                <option value="">Spender member (All)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-[#0c0f1d] text-white">{u.name}</option>
                ))}
              </select>
            </div>

            {/* Group selection */}
            <div>
              <select
                id="filter-group"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#080b15] border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 font-medium text-slate-200 cursor-pointer"
              >
                <option value="">Sub-Group (All)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id} className="bg-[#0c0f1d] text-white">{g.name.split(' (')[0]}</option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <select
                id="filter-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#080b15] border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 font-medium text-slate-200 cursor-pointer text-ellipsis"
              >
                <option value="overall" className="bg-[#0c0f1d] text-white">All Months (Overall)</option>
                {monthOptions.map(ym => (
                  <option key={ym} value={ym} className="bg-[#0c0f1d] text-white">{formatMonthLabel(ym)}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters / Date togglers button */}
            <div className="flex gap-2">
              <button 
                type="button" 
                id="btn-clear-filters"
                onClick={clearFilters}
                className="flex-1 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-mono font-bold select-none cursor-pointer transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Date Filters Row */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10 text-xs text-slate-400 w-full">
            <span className="font-mono font-bold text-slate-300">Date Range:</span>
            <div className="flex-1 min-w-[130px] flex items-center gap-2 bg-[#080b15] border border-white/10 px-3 py-1.5 rounded-xl">
              <span className="text-slate-500 font-mono text-[10px]">FROM</span>
              <input 
                type="date" 
                id="filter-date-from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none outline-none font-medium border-0 w-full font-mono"
              />
            </div>
            <div className="flex-1 min-w-[130px] flex items-center gap-2 bg-[#080b15] border border-white/10 px-3 py-1.5 rounded-xl">
              <span className="text-slate-500 font-mono text-[10px]">TO</span>
              <input 
                type="date" 
                id="filter-date-to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none outline-none font-medium border-0 w-full font-mono"
              />
            </div>
            
            {filteredExpenses.length !== expenses.length && (
              <span className="text-emerald-400 font-bold sm:ml-auto font-mono bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                Showing {filteredExpenses.length} of {expenses.length} results
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Expenses Table / Cards Grid */}
      <div className="glass-card rounded-3xl overflow-hidden border border-white/10">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-20 px-6">
            <FileSearch className="size-14 stroke-slate-700 mx-auto" />
            <h3 className="text-slate-200 font-bold font-sans text-lg mt-4">No transactions found</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto font-medium leading-relaxed">
              No expenses matched the configured criteria. Modify search, dates, or create a new manual expense record.
            </p>
            <button
              type="button"
              id="btn-add-expense-fallback"
              onClick={handleOpenCreate}
              className="mt-5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold font-mono rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all"
            >
              Log First Expense
            </button>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#060812]/70 text-slate-400 font-mono font-bold text-xs border-b border-white/10 uppercase tracking-wider">
                    <th className="py-4 px-6">Transaction / Notes</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4">Paid By</th>
                    <th className="py-4 px-4">Family Group</th>
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-6 text-right">Amount</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredExpenses.map((expense) => {
                    const spender = users.find(u => u.id === expense.paidBy);
                    const grp = groups.find(g => g.id === expense.groupId);
                    const canModify = !currentUser || expense.paidBy === currentUser.id;
                    
                    return (
                      <tr key={expense.id} className="hover:bg-white/5 transition-colors border-b border-white/5">
                        {/* Merchant and Notes */}
                        <td className="py-4 px-6 max-w-[280px]">
                          <div className="flex items-start gap-3">
                            {expense.originalImage ? (
                              <button 
                                type="button"
                                onClick={() => setViewerImage(expense.originalImage || null)}
                                className="size-11 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-all glow-pill"
                                title="Click to view full image"
                              >
                                <img 
                                  src={expense.originalImage} 
                                  alt="receipt preview" 
                                  className="size-full object-cover" 
                                  referrerPolicy="no-referrer"
                                />
                              </button>
                            ) : (
                              <div className="size-11 rounded-xl bg-[#080b15] flex items-center justify-center text-emerald-400 shrink-0 border border-white/10">
                                <Store className="size-5" />
                              </div>
                            )}
                            <div className="truncate">
                              <h4 className="font-bold text-slate-100 truncate text-sm" id={`merchant-${expense.id}`}>{expense.merchant}</h4>
                              <p className="text-xs text-slate-400 truncate mt-0.5 font-medium" id={`notes-${expense.id}`}>
                                {expense.notes || 'No notes tagged'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Category tag */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 font-bold text-emerald-400 font-mono">
                            <Tag className="size-3" />
                            {expense.category}
                          </span>
                        </td>

                        {/* Spender Name */}
                        <td className="py-4 px-4 font-semibold text-slate-200">
                          {spender ? spender.name : 'Unknown'}
                        </td>

                        {/* Sub Group */}
                        <td className="py-4 px-4 text-xs text-slate-400 font-medium">
                          {grp ? grp.name.split(' (')[0] : 'Unknown'}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-4 text-xs font-semibold text-slate-300 font-mono">
                          <div>{expense.date}</div>
                          {expense.createdAt && (
                            <div className="text-[10px] text-slate-500 font-sans mt-0.5" title="Server logged timestamp">
                              Logged: {formatLoggedTime(expense.createdAt)}
                            </div>
                          )}
                        </td>

                        {/* Total cost */}
                        <td className="py-4 px-6 text-right font-mono font-extrabold text-white text-base">
                          ₹{expense.amount.toLocaleString('en-IN')}
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              type="button"
                              id={`btn-edit-${expense.id}`}
                              disabled={isSyncing || !canModify}
                              onClick={() => handleOpenEdit(expense)}
                              className="p-2 hover:bg-white/10 text-slate-400 hover:text-emerald-400 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-white/10"
                              title={canModify ? "Edit receipt" : "Only the spender can edit this"}
                            >
                              <Edit3 className="size-4" />
                            </button>
                            <button 
                              type="button"
                              id={`btn-delete-${expense.id}`}
                              disabled={isSyncing || !canModify}
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this expenditure?')) {
                                  onDeleteExpense(expense.id);
                                }
                              }}
                              className="p-2 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-500/20"
                              title={canModify ? "Delete receipt" : "Only the spender can delete this"}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-white/5">
              {filteredExpenses.map((expense) => {
                const spender = users.find(u => u.id === expense.paidBy);
                const grp = groups.find(g => g.id === expense.groupId);
                const canModify = !currentUser || expense.paidBy === currentUser.id;
                
                return (
                  <div key={expense.id} className="p-4 space-y-3.5 hover:bg-white/5 transition-colors">
                    {/* Top Row: Merchant Details & Amount */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {expense.originalImage ? (
                          <button 
                            type="button"
                            onClick={() => setViewerImage(expense.originalImage || null)}
                            className="size-11 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-all glow-pill"
                            title="Click to view full image"
                          >
                            <img 
                              src={expense.originalImage} 
                              alt="receipt preview" 
                              className="size-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </button>
                        ) : (
                          <div className="size-11 rounded-xl bg-[#080b15] flex items-center justify-center text-emerald-400 shrink-0 border border-white/10">
                            <Store className="size-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-100 truncate text-sm" id={`mob-merchant-${expense.id}`}>{expense.merchant}</h4>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            {expense.date}
                            {expense.createdAt && (
                              <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                                Logged: {formatLoggedTime(expense.createdAt)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-extrabold text-white text-base">
                          ₹{expense.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Tags & Spender Info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-bold text-emerald-400 font-mono">
                          <Tag className="size-2.5" />
                          {expense.category}
                        </span>
                        {grp && (
                          <span className="inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono font-medium">
                            {grp.name.split(' (')[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 font-medium text-xs">
                        Paid by: <span className="text-slate-100 font-bold">{spender ? spender.name : 'Unknown'}</span>
                      </div>
                    </div>

                    {/* Notes Row if present */}
                    {expense.notes && (
                      <div className="text-xs text-slate-300 glass-panel p-3 rounded-xl border border-white/5 leading-relaxed break-words font-medium">
                        {expense.notes}
                      </div>
                    )}

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button 
                        type="button"
                        id={`mob-btn-edit-${expense.id}`}
                        disabled={isSyncing || !canModify}
                        onClick={() => handleOpenEdit(expense)}
                        className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={canModify ? "Edit receipt" : "Only the spender can edit this"}
                      >
                        <Edit3 className="size-3.5" /> Edit
                      </button>
                      <button 
                        type="button"
                        id={`mob-btn-delete-${expense.id}`}
                        disabled={isSyncing || !canModify}
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this expenditure?')) {
                            onDeleteExpense(expense.id);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={canModify ? "Delete receipt" : "Only the spender can delete this"}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 min-h-screen bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 overflow-y-auto w-full animate-fade-in">
          <div className="glass-card rounded-3xl shadow-2xl border border-white/10 max-w-xl w-full max-h-[90vh] flex flex-col mx-auto relative overflow-hidden">
            
            {/* Modal header */}
            <div className="px-7 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-white font-extrabold font-sans text-lg gradient-text-aurora">Record New Expenditure</h3>
                <p className="text-slate-400 text-xs mt-0.5 font-medium">Fill receipt details manually or let Gemini scan screenshots.</p>
              </div>
              <button 
                type="button"
                id="btn-close-create-modal"
                onClick={() => setIsCreateOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal content body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col overflow-hidden max-h-[calc(90vh-70px)]">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-7 space-y-4 custom-scrollbar">
                
                {/* Receipt screen reader (OCR) widget inside form */}
                <div className="glass-panel border border-white/10 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                  {formImage ? (
                    <div className="flex items-center gap-4 w-full text-left">
                      <button
                        type="button"
                        onClick={() => setViewerImage(formImage)}
                        className="size-16 object-cover rounded-xl border border-white/10 shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-all glow-pill"
                        title="Click to view full image"
                      >
                        <img 
                          src={formImage} 
                          alt="loaded bill" 
                          className="size-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </button>
                      <div className="overflow-hidden flex-1">
                        <p className="text-xs font-bold text-slate-100 truncate">Receipt Attachment Uploaded</p>
                        <button 
                          type="button" 
                          id="btn-remove-ocr-img"
                          disabled={isSyncing}
                          onClick={() => { setFormImage(null); setOcrSuccessMsg(''); }}
                          className="text-xs text-rose-400 hover:text-rose-300 font-bold font-mono cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-1 block"
                        >
                          Remove Image Asset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label id="lbl-ocr-upload" className={`w-full h-full flex flex-col items-center justify-center ${isSyncing ? 'cursor-not-allowed opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                      <UploadCloud className="size-9 stroke-emerald-400" />
                      <p className="text-slate-200 text-xs font-bold mt-2">Upload Receipt or Mobile Checkout Screen</p>
                      <p className="text-slate-400 text-[10px] font-mono mt-0.5">Supports PhonePe, GPay, Paytm, BHIM or camera invoices</p>
                      <input 
                        type="file" 
                        id="ocr-file-input"
                        accept="image/*" 
                        disabled={isSyncing}
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </label>
                  )}

                  {/* AI loading/status indicators */}
                  {ocrLoading && (
                    <div className="w-full mt-3 py-2 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 text-center flex items-center justify-center gap-2 font-bold font-mono">
                      <div className="size-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      Analyzing screen via Gemini OCR engine...
                    </div>
                  )}
                  {ocrSuccessMsg && !ocrLoading && (
                    <div className="w-full mt-3 py-2 px-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs text-center flex items-center justify-center gap-1.5 font-bold font-mono">
                      <CheckCircle className="size-4 shrink-0 text-emerald-400" />
                      <span>{ocrSuccessMsg}</span>
                    </div>
                  )}
                </div>

                {/* Form Input fields */}
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Cost Amount */}
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="form-amount" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Amount Spent (₹) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-mono font-bold text-sm">₹</span>
                      <input 
                        type="number" 
                        id="form-amount"
                        required
                        disabled={isSyncing}
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full pl-8 pr-3 py-3 bg-[#080b15] border border-white/10 text-slate-100 rounded-2xl focus:outline-none focus:border-emerald-400 font-extrabold font-mono text-base disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Date */}
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="form-date" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Expense Date *</label>
                    <input 
                      type="date" 
                      id="form-date"
                      required
                      disabled={isSyncing}
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 rounded-2xl focus:outline-none focus:border-emerald-400 font-semibold font-mono text-slate-200 disabled:opacity-50"
                    />
                  </div>

                  {/* Merchant */}
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="form-merchant" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Merchant / Vendor</label>
                    <input 
                      type="text" 
                      id="form-merchant"
                      value={formMerchant}
                      onChange={(e) => setFormMerchant(e.target.value)}
                      disabled={isSyncing}
                      placeholder="e.g. DMart, Netflix"
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 text-slate-100 rounded-2xl focus:outline-none focus:border-emerald-400 font-medium text-sm disabled:opacity-50"
                    />
                  </div>

                  {/* Category selectors */}
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="form-category" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Finance Category</label>
                    <select
                      id="form-category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      disabled={isSyncing}
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 rounded-2xl focus:outline-none focus:border-emerald-400 font-medium text-slate-200 text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-[#0c0f1d] text-white">{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Spender family member */}
                  <div className="col-span-2">
                    <label htmlFor="form-paid-by" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Paid By (Family Member)</label>
                    <select
                      id="form-paid-by"
                      value={formPaidBy}
                      onChange={(e) => setFormPaidBy(e.target.value)}
                      disabled={isSyncing}
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 rounded-2xl focus:outline-none focus:border-emerald-400 font-bold text-slate-200 text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {users.map(u => {
                        const userGrp = groups.find(g => g.id === u.groupId);
                        return (
                          <option key={u.id} value={u.id} className="bg-[#0c0f1d] text-white">{u.name} ({userGrp ? userGrp.name.split(' (')[0] : 'No Group'})</option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Notes entry */}
                  <div className="col-span-2">
                    <label htmlFor="form-notes" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Internal Notes</label>
                    <textarea 
                      id="form-notes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      disabled={isSyncing}
                      rows={2}
                      placeholder="e.g. weekly groceries purchase bundle"
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 text-slate-100 rounded-2xl focus:outline-none focus:border-emerald-400 font-medium text-sm resize-none disabled:opacity-50"
                    />
                  </div>

                </div>
              </div>

              {/* Pinned Modal footer submit triggers */}
              <div className="border-t border-white/10 p-5 bg-[#090c19] flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  id="btn-cancel-create"
                  disabled={isSyncing}
                  onClick={() => setIsCreateOpen(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-xs font-bold font-mono cursor-pointer transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  id="btn-submit-create"
                  disabled={isSyncing}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold font-mono rounded-2xl text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  {isSyncing ? (
                    <>
                      <span className="size-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Entry</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && selectedExpense && (
        <div className="fixed inset-0 min-h-screen bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 overflow-y-auto w-full animate-fade-in">
          <div className="glass-card rounded-3xl shadow-2xl border border-white/10 max-w-xl w-full max-h-[90vh] flex flex-col mx-auto relative overflow-hidden">
            
            <div className="px-7 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-white font-extrabold font-sans text-lg gradient-text-aurora">Edit Expenditure Parameters</h3>
                <p className="text-slate-400 text-xs mt-0.5 font-medium">Edit details for expenditure ID {selectedExpense.id}</p>
              </div>
              <button 
                type="button"
                id="btn-close-edit-modal"
                onClick={() => setIsEditOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col overflow-hidden max-h-[calc(90vh-70px)]">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-7 space-y-4 custom-scrollbar">
                
                <div className="grid grid-cols-2 gap-4">
                  
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-amount" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-mono font-bold text-sm">₹</span>
                      <input 
                        type="number" 
                        id="edit-amount"
                        required
                        disabled={isSyncing}
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className="w-full pl-8 pr-3 py-3 bg-[#080b15] border border-white/10 text-white rounded-2xl focus:outline-none focus:border-emerald-400 font-extrabold font-mono text-base disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-date" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Expense Date *</label>
                    <input 
                      type="date" 
                      id="edit-date"
                      required
                      disabled={isSyncing}
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 rounded-2xl focus:outline-none focus:border-emerald-400 font-semibold font-mono text-slate-200 disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-merchant" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Merchant / Payee</label>
                    <input 
                      type="text" 
                      id="edit-merchant"
                      value={formMerchant}
                      onChange={(e) => setFormMerchant(e.target.value)}
                      disabled={isSyncing}
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 text-white rounded-2xl focus:outline-none focus:border-emerald-400 font-medium text-sm disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-category" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      id="edit-category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      disabled={isSyncing}
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 rounded-2xl focus:outline-none focus:border-emerald-400 font-medium text-slate-200 text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-[#0c0f1d] text-white">{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="edit-paid-by" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Paid By (Family Member)</label>
                    <select
                      id="edit-paid-by"
                      value={formPaidBy}
                      onChange={(e) => setFormPaidBy(e.target.value)}
                      disabled={isSyncing}
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 rounded-2xl focus:outline-none focus:border-emerald-400 font-bold text-slate-200 text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id} className="bg-[#0c0f1d] text-white">{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="edit-notes" className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-1.5">Internal Notes</label>
                    <textarea 
                      id="edit-notes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      disabled={isSyncing}
                      rows={2}
                      className="w-full px-4 py-3 bg-[#080b15] border border-white/10 text-slate-100 rounded-2xl focus:outline-none focus:border-emerald-400 font-medium text-sm resize-none disabled:opacity-50"
                    />
                  </div>

                </div>
              </div>

              {/* Pinned Modal footer submit triggers */}
              <div className="border-t border-white/10 p-5 bg-[#090c19] flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  id="btn-cancel-edit"
                  disabled={isSyncing}
                  onClick={() => setIsEditOpen(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-xs font-bold font-mono cursor-pointer transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  id="btn-submit-edit"
                  disabled={isSyncing}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold font-mono rounded-2xl text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  {isSyncing ? (
                    <>
                      <span className="size-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Full Image Viewer Lightbox */}
      {viewerImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setViewerImage(null)}
        >
          <button
            type="button"
            className="absolute top-5 right-5 p-2.5 text-slate-300 hover:text-white rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 transition-all cursor-pointer z-[70] flex items-center justify-center"
            onClick={() => setViewerImage(null)}
          >
            <X className="size-6" />
          </button>
          <div 
            className="relative max-w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewerImage}
              alt="Full receipt view"
              className="max-w-[95vw] max-h-[85vh] md:max-w-[90vw] md:max-h-[90vh] object-contain rounded-2xl border border-white/15 shadow-2xl glow-pill"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

    </div>
  );
}
