/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
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
  onAddExpense: (exp: Omit<Expense, 'id' | 'groupId' | 'createdAt'>, imageBase64?: string) => Promise<void>;
  onEditExpense: (id: string, updated: Partial<Expense>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onTriggerOcr: (base64Image: string) => Promise<any>;
}

const CATEGORIES = [
  'Grocery',
  'Utilities',
  'Dining Out',
  'Rent & Living',
  'Vegetables & Fruits',
  'Medical',
  'Entertainment',
  'Travel & Commute',
  'Shopping',
  'Others'
];

export default function ExpensesView({ 
  state, 
  onAddExpense, 
  onEditExpense, 
  onDeleteExpense,
  onTriggerOcr
}: ExpensesViewProps) {
  const { expenses, users, groups } = state;

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPaidBy, setSelectedPaidBy] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Form states
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Grocery');
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
    setFormCategory('Grocery');
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

      return matchesSearch && matchesCategory && matchesUser && matchesGroup && matchesFrom && matchesTo;
    }).sort((a, b) => b.date.localeCompare(a.date)); // Sort newest date first
  }, [expenses, searchTerm, selectedCategory, selectedPaidBy, selectedGroup, dateFrom, dateTo]);

  // Clear all filters helper
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedPaidBy('');
    setSelectedGroup('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
       {/* Search and Filters Header block */}
      <div className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-white font-bold font-sans text-lg">Family Ledger Entries</h2>
            <p className="text-slate-500 text-xs mt-0.5">Filter, search, audit and manually record joint expenditures.</p>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              type="button" 
              id="btn-toggle-filters-mobile"
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer md:hidden"
            >
              <Filter className="size-4" />
              {showFiltersMobile ? 'Hide Filters' : 'Show Filters'}
            </button>
            
            <button 
              type="button" 
              id="btn-add-expense-modal"
              onClick={handleOpenCreate}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0"
            >
              <Plus className="size-4" />
              Add Expense Receipt
            </button>
          </div>
        </div>

        {/* Collapsible Filter panel wrapper */}
        <div className={`${showFiltersMobile ? 'block' : 'hidden'} md:block space-y-4`}>
          {/* Filters Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            {/* Search text input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="size-4" />
              </span>
              <input 
                type="text" 
                id="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search merchant, notes..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-650 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Category selection */}
            <div>
              <select
                id="filter-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-medium text-slate-300"
              >
                <option value="">Categories (All)</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Paid By selection */}
            <div>
              <select
                id="filter-paid-by"
                value={selectedPaidBy}
                onChange={(e) => setSelectedPaidBy(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-medium text-slate-300"
              >
                <option value="">Spender member (All)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Group selection */}
            <div>
              <select
                id="filter-group"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-medium text-slate-300"
              >
                <option value="">Sub-Group (All)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name.split(' (')[0]}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters / Date togglers button */}
            <div className="flex gap-2">
              <button 
                type="button" 
                id="btn-clear-filters"
                onClick={clearFilters}
                className="flex-1 px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold select-none cursor-pointer transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Date Filters Row */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-800 text-xs text-slate-500 w-full">
            <span className="font-semibold text-slate-400">Date Range:</span>
            <div className="flex-1 min-w-[130px] flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-1 rounded-md">
              <span className="text-slate-500">From</span>
              <input 
                type="date" 
                id="filter-date-from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none outline-none font-medium border-0 w-full"
              />
            </div>
            <div className="flex-1 min-w-[130px] flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-1 rounded-md">
              <span className="text-slate-500">To</span>
              <input 
                type="date" 
                id="filter-date-to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none outline-none font-medium border-0 w-full"
              />
            </div>
            
            {filteredExpenses.length !== expenses.length && (
              <span className="text-indigo-400 font-bold sm:ml-auto font-mono bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.5 rounded">
                Showing {filteredExpenses.length} of {expenses.length} results
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Expenses Table / Cards Grid */}
      <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-20 px-6">
            <FileSearch className="size-12 stroke-slate-850 mx-auto" />
            <h3 className="text-slate-200 font-bold font-sans text-base mt-3">No transactions found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              No expenses matched the configured criteria. Modify search, dates, or create a new manual expense record.
            </p>
            <button
              type="button"
              id="btn-add-expense-fallback"
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow transition"
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
                  <tr className="bg-slate-950/40 text-slate-400 font-sans font-semibold text-xs border-b border-slate-800">
                    <th className="py-4 px-6">Transaction / Notes</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4">Paid By</th>
                    <th className="py-4 px-4">Family Group</th>
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-6 text-right">Amount</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {filteredExpenses.map((expense) => {
                    const spender = users.find(u => u.id === expense.paidBy);
                    const grp = groups.find(g => g.id === expense.groupId);
                    
                    return (
                      <tr key={expense.id} className="hover:bg-slate-950/40 transition-colors border-b border-slate-800/50">
                        {/* Merchant and Notes */}
                        <td className="py-4 px-6 max-w-[280px]">
                          <div className="flex items-start gap-3">
                            {expense.originalImage ? (
                              <div className="size-10 rounded bg-indigo-950/40 flex items-center justify-center border border-indigo-900/40 overflow-hidden shrink-0">
                                <img 
                                  src={expense.originalImage} 
                                  alt="receipt preview" 
                                  className="size-full object-cover" 
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="size-10 rounded-lg bg-slate-950 flex items-center justify-center text-slate-500 shrink-0">
                                <Store className="size-5" />
                              </div>
                            )}
                            <div className="truncate">
                              <h4 className="font-semibold text-slate-100 truncate" id={`merchant-${expense.id}`}>{expense.merchant}</h4>
                              <p className="text-xs text-slate-550 truncate mt-0.5" id={`notes-${expense.id}`}>
                                {expense.notes || 'No notes tagged'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Category tag */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#6366f1]/10 border border-[#6366f1]/20 font-medium text-indigo-300">
                            <Tag className="size-3" />
                            {expense.category}
                          </span>
                        </td>

                        {/* Spender Name */}
                        <td className="py-4 px-4 font-semibold text-slate-355">
                          {spender ? spender.name : 'Unknown'}
                        </td>

                        {/* Sub Group */}
                        <td className="py-4 px-4 text-xs text-slate-400">
                          {grp ? grp.name.split(' (')[0] : 'Unknown'}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-4 text-xs font-medium text-slate-400 font-mono">
                          {expense.date}
                        </td>

                        {/* Total cost */}
                        <td className="py-4 px-6 text-right font-mono font-bold text-white">
                          ₹{expense.amount.toLocaleString('en-IN')}
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              type="button"
                              id={`btn-edit-${expense.id}`}
                              onClick={() => handleOpenEdit(expense)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
                              title="Edit receipt"
                            >
                              <Edit3 className="size-4" />
                            </button>
                            <button 
                              type="button"
                              id={`btn-delete-${expense.id}`}
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this expenditure?')) {
                                  onDeleteExpense(expense.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-955/30 text-rose-400 hover:text-rose-350 rounded-md transition-colors cursor-pointer"
                              title="Delete receipt"
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
            <div className="block md:hidden divide-y divide-slate-800/60">
              {filteredExpenses.map((expense) => {
                const spender = users.find(u => u.id === expense.paidBy);
                const grp = groups.find(g => g.id === expense.groupId);
                
                return (
                  <div key={expense.id} className="p-4 space-y-3 hover:bg-slate-950/20 transition-colors">
                    {/* Top Row: Merchant Details & Amount */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {expense.originalImage ? (
                          <div className="size-10 rounded bg-indigo-950/40 flex items-center justify-center border border-indigo-900/40 overflow-hidden shrink-0">
                            <img 
                              src={expense.originalImage} 
                              alt="receipt preview" 
                              className="size-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="size-10 rounded-lg bg-slate-950 flex items-center justify-center text-slate-500 shrink-0">
                            <Store className="size-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-100 truncate text-sm" id={`mob-merchant-${expense.id}`}>{expense.merchant}</h4>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{expense.date}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-white text-base">
                          ₹{expense.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Tags & Spender Info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#6366f1]/10 border border-[#6366f1]/20 font-medium text-indigo-300">
                          <Tag className="size-2.5" />
                          {expense.category}
                        </span>
                        {grp && (
                          <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-medium">
                            {grp.name.split(' (')[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 font-medium text-xs">
                        Paid by: <span className="text-slate-200 font-semibold">{spender ? spender.name : 'Unknown'}</span>
                      </div>
                    </div>

                    {/* Notes Row if present */}
                    {expense.notes && (
                      <div className="text-xs text-slate-450 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850/60 leading-relaxed break-words">
                        {expense.notes}
                      </div>
                    )}

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button 
                        type="button"
                        id={`mob-btn-edit-${expense.id}`}
                        onClick={() => handleOpenEdit(expense)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit3 className="size-3.5" /> Edit
                      </button>
                      <button 
                        type="button"
                        id={`mob-btn-delete-${expense.id}`}
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this expenditure?')) {
                            onDeleteExpense(expense.id);
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-955/30 hover:bg-rose-955/50 text-rose-400 border border-rose-900/30 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
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

      {/* CREATE MODAL with fully functional Gemini scanner */}
      {isCreateOpen && (
        <div className="fixed inset-0 min-h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto w-full">
          <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 max-w-xl w-full max-h-[90vh] flex flex-col mx-auto">
            
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold font-sans text-base">Record New Expenditure</h3>
                <p className="text-slate-500 text-xs mt-0.5">Fill receipt details manually or let Gemini scan screenshots.</p>
              </div>
              <button 
                type="button"
                id="btn-close-create-modal"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-350 rounded-md cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal content body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col overflow-hidden max-h-[calc(90vh-70px)]">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                
                {/* Receipt screen reader (OCR) widget inside form */}
                <div className="bg-slate-950 border border-slate-800 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  {formImage ? (
                    <div className="flex items-center gap-3 w-full text-left">
                      <img 
                        src={formImage} 
                        alt="loaded bill" 
                        className="size-16 object-cover rounded border border-slate-800 shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="overflow-hidden flex-1">
                        <p className="text-xs font-semibold text-slate-200 truncate">Image attachment uploaded</p>
                        <button 
                          type="button" 
                          id="btn-remove-ocr-img"
                          onClick={() => { setFormImage(null); setOcrSuccessMsg(''); }}
                          className="text-[10px] text-rose-450 hover:underline font-medium cursor-pointer"
                        >
                          Remove image asset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label id="lbl-ocr-upload" className="w-full h-full cursor-pointer flex flex-col items-center justify-center">
                      <UploadCloud className="size-8 stroke-slate-500" />
                      <p className="text-slate-350 text-xs font-semibold mt-1">Upload Receipt or Mobile Checkout Screen</p>
                      <p className="text-slate-550 text-[10px] mt-0.5">Supports PhonePe, GPay, Paytm, BHIM or camera invoices</p>
                      <input 
                        type="file" 
                        id="ocr-file-input"
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </label>
                  )}

                  {/* AI loading/status indicators */}
                  {ocrLoading && (
                    <div className="w-full mt-3 py-1.5 px-3 bg-indigo-950/40 border border-indigo-900/40 rounded text-xs text-indigo-300 text-center flex items-center justify-center gap-2 font-medium">
                      <div className="size-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      Analyzing screen via Gemini OCR engine...
                    </div>
                  )}
                  {ocrSuccessMsg && !ocrLoading && (
                    <div className="w-full mt-3 py-1.5 px-3 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 rounded text-xs text-center flex items-center justify-center gap-1 font-medium">
                      <CheckCircle className="size-4 shrink-0 text-emerald-500" />
                      <span>{ocrSuccessMsg}</span>
                    </div>
                  )}
                </div>

                {/* Form Input fields */}
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Cost Amount */}
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="form-amount" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount Spend (₹) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-semibold text-sm">₹</span>
                      <input 
                        type="number" 
                        id="form-amount"
                        required
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full pl-7 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold font-mono"
                      />
                    </div>
                  </div>

                  {/* Date */}
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="form-date" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Expense Date *</label>
                    <input 
                      type="date" 
                      id="form-date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold font-mono text-slate-350"
                    />
                  </div>

                  {/* Merchant */}
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="form-merchant" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Merchant / Vendor</label>
                    <input 
                      type="text" 
                      id="form-merchant"
                      value={formMerchant}
                      onChange={(e) => setFormMerchant(e.target.value)}
                      placeholder="e.g. DMart, Tata Power, Netflix"
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  {/* Category selectors */}
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="form-category" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Finance Category</label>
                    <select
                      id="form-category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-medium text-slate-300"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Spender family member */}
                  <div className="col-span-2">
                    <label htmlFor="form-paid-by" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Paid By (Family Member)</label>
                    <select
                      id="form-paid-by"
                      value={formPaidBy}
                      onChange={(e) => setFormPaidBy(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold text-slate-300"
                    >
                      {users.map(u => {
                        const userGrp = groups.find(g => g.id === u.groupId);
                        return (
                          <option key={u.id} value={u.id}>{u.name} ({userGrp ? userGrp.name.split(' (')[0] : 'No Group'})</option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Notes entry */}
                  <div className="col-span-2">
                    <label htmlFor="form-notes" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Internal Notes</label>
                    <textarea 
                      id="form-notes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. weekly groceries purchase bundle"
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium resize-none resize-y"
                    />
                  </div>

                </div>
              </div>

              {/* Pinned Modal footer submit triggers */}
              <div className="border-t border-slate-800 p-5 bg-slate-900 flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  id="btn-cancel-create"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  id="btn-submit-create"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                >
                  Save Entry
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && selectedExpense && (
        <div className="fixed inset-0 min-h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto w-full">
          <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 max-w-xl w-full max-h-[90vh] flex flex-col mx-auto">
            
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold font-sans text-base">Repropose Expenditure Parameters</h3>
                <p className="text-slate-500 text-xs mt-0.5">Edit details for expenditure ID {selectedExpense.id}</p>
              </div>
              <button 
                type="button"
                id="btn-close-edit-modal"
                onClick={() => setIsEditOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-350 rounded-md cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col overflow-hidden max-h-[calc(90vh-70px)]">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                
                <div className="grid grid-cols-2 gap-4">
                  
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-amount" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-semibold text-sm">₹</span>
                      <input 
                        type="number" 
                        id="edit-amount"
                        required
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 text-white rounded-lg focus:outline-none focus:border-indigo-500 font-semibold font-mono"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-date" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Expense Date *</label>
                    <input 
                      type="date" 
                      id="edit-date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold font-mono text-slate-350"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-merchant" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Merchant / Payee</label>
                    <input 
                      type="text" 
                      id="edit-merchant"
                      value={formMerchant}
                      onChange={(e) => setFormMerchant(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-955 border border-slate-800 text-white rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-category" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      id="edit-category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-medium text-slate-300"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="edit-paid-by" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Paid By (Family Member)</label>
                    <select
                      id="edit-paid-by"
                      value={formPaidBy}
                      onChange={(e) => setFormPaidBy(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-955 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold text-slate-300"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="edit-notes" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Internal Notes</label>
                    <textarea 
                      id="edit-notes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium resize-none resize-y"
                    />
                  </div>

                </div>
              </div>

              {/* Pinned Modal footer submit triggers */}
              <div className="border-t border-slate-800 p-5 bg-slate-900 flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  id="btn-cancel-edit"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  id="btn-submit-edit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
