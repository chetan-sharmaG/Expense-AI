/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { DBState, Group, Settlement, User } from '../types';
import { calculateGroupSettlements, ProposedSettlement } from '../utils/settlementHelper';
import { 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  History, 
  UserSquare2, 
  HelpCircle, 
  Plus, 
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Scale
} from 'lucide-react';

interface SettlementViewProps {
  state: DBState;
  onAddSettlement: (settlement: Omit<Settlement, 'id' | 'status' | 'date'>) => Promise<void>;
  onMarkSettleCompleted: (id: string) => Promise<void>;
  onDeleteSettlement: (id: string) => Promise<void>;
  isSyncing: boolean;
}

export default function SettlementView({ 
  state, 
  onAddSettlement, 
  onMarkSettleCompleted,
  onDeleteSettlement,
  isSyncing
}: SettlementViewProps) {
  const { expenses, groups, users, settlements } = state;

  // Split configurations
  const [splitMethod, setSplitMethod] = useState<'equal_groups' | 'member_count'>('equal_groups');
  const [registeringProposal, setRegisteringProposal] = useState<ProposedSettlement | null>(null);
  const [notesInput, setNotesInput] = useState('');

  // Selected Billing Period (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculate unique months available for dropdown options
  const monthOptions = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Always include current month
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthStr);
    
    // Extract from expenses
    expenses.forEach(exp => {
      if (exp.date && exp.date.length >= 7) {
        monthsSet.add(exp.date.slice(0, 7));
      }
    });

    // Extract from settlements
    settlements.forEach(s => {
      if (s.billingMonth) {
        monthsSet.add(s.billingMonth);
      } else if (s.date && s.date.length >= 7) {
        monthsSet.add(s.date.slice(0, 7));
      }
    });

    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [expenses, settlements]);

  // Format month YYYY-MM label to friendly string (e.g. "June 2026")
  const formatMonthLabel = (ym: string) => {
    const [year, month] = ym.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
    return dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Filter expenses matching the active selected billing period
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => exp.date && exp.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  // Calculate balancing rules for the selected billing month
  const { summaries, totalFamilySpend, proposals } = useMemo(() => {
    return calculateGroupSettlements(filteredExpenses, groups, splitMethod, users);
  }, [filteredExpenses, groups, splitMethod, users]);

  // Current Month's Pending Settlements
  const currentMonthPending = useMemo(() => {
    return settlements.filter(s => {
      const m = s.billingMonth || (s.date ? s.date.slice(0, 7) : '');
      return m === selectedMonth && s.status === 'pending';
    });
  }, [settlements, selectedMonth]);

  // Unpaid Dues from Previous Months
  const previousMonthsPending = useMemo(() => {
    return settlements.filter(s => {
      const m = s.billingMonth || (s.date ? s.date.slice(0, 7) : '');
      return m !== selectedMonth && s.status === 'pending';
    });
  }, [settlements, selectedMonth]);

  // Current Month's Settled History
  const currentMonthSettledHistory = useMemo(() => {
    return settlements.filter(s => {
      const m = s.billingMonth || (s.date ? s.date.slice(0, 7) : '');
      return m === selectedMonth && s.status === 'settled';
    });
  }, [settlements, selectedMonth]);

  // Handle register a proposal to DB
  const handleOpenRegister = (prop: ProposedSettlement) => {
    setRegisteringProposal(prop);
    setNotesInput(`Balancing payment: ${prop.fromGroupName} ➔ ${prop.toGroupName}`);
  };

  const handleConfirmRegister = async () => {
    if (!registeringProposal) return;
    
    await onAddSettlement({
      fromGroup: registeringProposal.fromGroupId,
      toGroup: registeringProposal.toGroupId,
      amount: registeringProposal.amount,
      notes: notesInput,
      billingMonth: selectedMonth
    });

    setRegisteringProposal(null);
    setNotesInput('');
  };

  return (
    <div className="space-y-6">
      
      {/* Settings Row / Header */}
      <div className="glass-card p-6 rounded-3xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <h2 className="text-white font-extrabold font-sans text-xl gradient-text-aurora">Group Settlement Engine</h2>
          <p className="text-slate-300 text-xs mt-1 font-medium">Calculate fair fractional splits and balance liabilities between sub-family units.</p>
        </div>

        {/* Dropdown and toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Billing Period Selector */}
          <div className="flex items-center gap-2 bg-[#080b15] border border-white/10 px-3.5 py-2 rounded-2xl shrink-0">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Billing Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-0 text-slate-100 text-xs font-bold font-mono focus:outline-none cursor-pointer pr-1"
            >
              {monthOptions.map(ym => (
                <option key={ym} value={ym} className="bg-[#0c0f1d] text-white">
                  {formatMonthLabel(ym)}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle algorithm buttons */}
          <div className="bg-[#080b15] border border-white/10 p-1 rounded-2xl flex items-center gap-1 shrink-0">
            <button
              type="button"
              id="btn-split-equal"
              onClick={() => setSplitMethod('equal_groups')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                splitMethod === 'equal_groups' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              Equal Split (By Groups)
            </button>
            <button
              type="button"
              id="btn-split-members"
              onClick={() => setSplitMethod('member_count')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                splitMethod === 'member_count' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              Weighted Split (By Member Count)
            </button>
          </div>
        </div>
      </div>

      {/* Main calculation breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ledger Balance Sheet (Left 2 Columns) */}
        <div className="glass-card p-6 rounded-3xl lg:col-span-2 min-w-0 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-extrabold font-sans text-base">Ledger Balance Sheet</h3>
            <span className="text-xs text-slate-400 font-medium">
              Total Pool spending: <b className="font-mono text-emerald-400 font-extrabold text-sm ml-1">₹{totalFamilySpend.toLocaleString('en-IN')}</b>
            </span>
          </div>

          <div>
            {/* Desktop Balance Sheet Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[#060812]/70 border-b border-white/10 text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-5">Subgroup / Unit</th>
                    <th className="py-4 px-5 text-right">Total Spent</th>
                    <th className="py-4 px-5 text-right">Target Fair share</th>
                    <th className="py-4 px-5 text-right">Net Balance Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summaries.map((summary) => {
                    const isDebtor = summary.netBalance < 0;
                    const absVal = Math.abs(summary.netBalance);
                    
                    return (
                      <tr key={summary.groupId} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-5">
                          <span className="font-bold text-slate-100 block">{summary.groupName}</span>
                          {splitMethod === 'member_count' && (
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                              {users.filter(u => u.groupId === summary.groupId).length} members assigned
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right font-mono font-extrabold text-white">
                          ₹{summary.totalSpent.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-5 text-right font-mono text-slate-400">
                          ₹{summary.fairShare.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-5 text-right font-mono">
                          {summary.netBalance === 0 ? (
                            <span className="text-slate-400 font-bold text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-xl inline-block">Balanced</span>
                          ) : isDebtor ? (
                            <span className="text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-xl inline-flex items-center gap-1.5 text-xs">
                              <TrendingDown className="size-3.5" /> Owes ₹{absVal.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl inline-flex items-center gap-1.5 text-xs">
                              <TrendingUp className="size-3.5" /> Receives ₹{absVal.toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Balance Sheet Card List */}
            <div className="block md:hidden divide-y divide-white/5">
              {summaries.map((summary) => {
                const isDebtor = summary.netBalance < 0;
                const absVal = Math.abs(summary.netBalance);
                
                return (
                  <div key={summary.groupId} className="py-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-100 text-sm block">{summary.groupName}</span>
                        {splitMethod === 'member_count' && (
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            {users.filter(u => u.groupId === summary.groupId).length} members assigned
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 font-mono">
                        {summary.netBalance === 0 ? (
                          <span className="text-slate-400 text-xs font-bold bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">Balanced</span>
                        ) : isDebtor ? (
                          <span className="text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 text-xs border border-rose-500/20">
                            <TrendingDown className="size-3" /> Owes ₹{absVal.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 text-xs border border-emerald-500/20">
                            <TrendingUp className="size-3" /> Receives ₹{absVal.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-[#080b15] p-3 rounded-2xl border border-white/10 text-xs">
                      <div>
                        <span className="text-slate-500 block uppercase font-mono font-bold text-[9px] tracking-wider">Total Spent</span>
                        <span className="font-mono font-extrabold text-white text-sm mt-0.5 block">₹{summary.totalSpent.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase font-mono font-bold text-[9px] tracking-wider">Target Share</span>
                        <span className="font-mono text-slate-300 text-sm mt-0.5 block">₹{summary.fairShare.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl text-xs text-slate-300 flex items-start gap-3 leading-relaxed border border-white/10">
            <Scale className="size-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-100">How this settlement is calculated:</p>
              {splitMethod === 'equal_groups' ? (
                <p className="mt-1 text-slate-300 font-medium">
                  1. Total pool spending (₹{totalFamilySpend.toLocaleString('en-IN')}) is distributed equally across active family groups.
                  2. Your group is credited for actual payments made. 
                  3. If you spent more than your share, you receive the difference. If you spent less, you pay the difference.
                </p>
              ) : (
                <p className="mt-1 text-slate-300 font-medium">
                  1. Total spending (₹{totalFamilySpend.toLocaleString('en-IN')}) is divided based on member count inside each group.
                  2. This weights larger group structures with a proportional share while keeping single spend units fair.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Suggested Payments Proposals (Right Column) */}
        <div className="glass-card p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <h3 className="text-white font-extrabold font-sans text-base">Recommended Clearing Payments</h3>
            <p className="text-slate-400 text-xs mt-0.5 font-medium">Automated path of transactions to reach zero-debt balance.</p>
          </div>

          <div className="flex-1 mt-4 space-y-3.5 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
            {proposals.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="size-12 stroke-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-slate-200 mt-3">All accounts balanced!</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">No settlement payments required.</p>
              </div>
            ) : (
              proposals.map((prop, idx) => (
                <div key={`${prop.fromGroupId}-${prop.toGroupId}-${idx}`} className="p-4 bg-[#080b15] border border-white/10 rounded-2xl relative flex flex-col justify-between hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-left">
                      <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider block">Debtor</span>
                      <span className="text-xs font-bold text-rose-400">{prop.fromGroupName.split(' (')[0]}</span>
                    </div>
                    
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-xs font-extrabold font-mono text-emerald-400">₹{prop.amount.toLocaleString('en-IN')}</span>
                      <ArrowRight className="size-4 text-slate-400 mt-0.5" />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider block">Creditor</span>
                      <span className="text-xs font-bold text-emerald-400">{prop.toGroupName.split(' (')[0]}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">Direct clearing path</span>
                    <button
                      type="button"
                      id={`btn-reg-prop-${idx}`}
                      disabled={isSyncing}
                      onClick={() => handleOpenRegister(prop)}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold font-mono transition-all rounded-xl text-[10px] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02]"
                    >
                      Record Payment
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="border-t border-white/10 pt-3 mt-4 text-center">
            <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider">Simplification math active 🚀</span>
          </div>
        </div>

      </div>

      {/* Registers pop-up Modal */}
      {registeringProposal && (
        <div className="fixed inset-0 min-h-screen bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-3xl p-6 shadow-2xl border border-white/10 max-w-sm w-full mx-auto animate-fade-in space-y-4">
            <div>
              <h4 className="text-white font-extrabold font-sans text-base gradient-text-aurora">Record Settlement Payment</h4>
              <p className="text-slate-300 text-xs mt-1 font-medium">
                Store this transaction in the ledger system as pending until confirmed with banking receipts.
              </p>
            </div>

            <div className="bg-[#080b15] p-4 rounded-2xl space-y-2 border border-white/10 text-xs">
              <p className="flex justify-between items-center text-slate-400">
                <span>Paying Group:</span>
                <span className="font-bold text-rose-400">{registeringProposal.fromGroupName.split(' (')[0]}</span>
              </p>
              <p className="flex justify-between items-center text-slate-400">
                <span>Receiving Group:</span>
                <span className="font-bold text-emerald-400">{registeringProposal.toGroupName.split(' (')[0]}</span>
              </p>
              <p className="flex justify-between items-center pt-2 border-t border-white/10 text-base font-extrabold text-white font-mono">
                <span>Amount:</span>
                <span className="text-emerald-400">₹{registeringProposal.amount.toLocaleString('en-IN')}</span>
              </p>
            </div>

            {/* Note entry */}
            <div className="space-y-1.5">
              <label htmlFor="proposal-notes" className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block">Internal Notes</label>
              <input 
                type="text" 
                id="proposal-notes"
                disabled={isSyncing}
                value={notesInput} 
                onChange={(e) => setNotesInput(e.target.value)} 
                className="w-full px-3.5 py-2 text-xs bg-[#080b15] border border-white/10 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-medium disabled:opacity-50"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-close-register"
                disabled={isSyncing}
                onClick={() => setRegisteringProposal(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl font-bold font-mono cursor-pointer border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-register"
                disabled={isSyncing}
                onClick={handleConfirmRegister}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs rounded-xl font-bold font-mono uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <span className="size-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Logging...</span>
                  </>
                ) : (
                  <span>Log Settlement</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlements Lists Panels (Pending vs History) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pending Settlements */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-400" />
            <h3 className="text-white font-extrabold font-sans text-base">Pending Settlements & Unpaid Dues</h3>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            
            {/* Section A: Current Selected Month Pending */}
            <div>
              <span className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block mb-2">
                Active Billing Month ({formatMonthLabel(selectedMonth)})
              </span>
              <div className="divide-y divide-white/5 bg-[#080b15] rounded-2xl border border-white/10 px-4 py-1">
                {currentMonthPending.length === 0 ? (
                  <p className="text-slate-400 text-center py-6 text-xs font-medium italic">No pending transactions registered for this month.</p>
                ) : (
                  currentMonthPending.map((set) => {
                    const fromG = groups.find(g => g.id === set.fromGroup);
                    const toG = groups.find(g => g.id === set.toGroup);

                    return (
                      <div key={set.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">
                            {fromG ? fromG.name.split(' (')[0] : 'Unknown'} ➔ {toG ? toG.name.split(' (')[0] : 'Unknown'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{set.notes || 'Group balancing settle'}</p>
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-amber-500/10 text-amber-400 font-bold font-mono uppercase rounded-md border border-amber-500/20 mt-1">
                            Pending payment
                          </span>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-3">
                          <div className="font-mono font-extrabold text-white text-sm">₹{set.amount.toLocaleString('en-IN')}</div>
                          <button
                            type="button"
                            id={`btn-settle-${set.id}`}
                            disabled={isSyncing}
                            onClick={() => onMarkSettleCompleted(set.id)}
                            className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold font-mono cursor-pointer transition-all disabled:opacity-50"
                          >
                            Mark Paid
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Section B: Unpaid Dues from Previous Months */}
            <div>
              <span className="text-[10px] uppercase font-bold font-mono text-rose-400 tracking-wider block mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block animate-pulse"></span>
                Unpaid Dues from Previous Months
              </span>
              <div className="divide-y divide-white/5 bg-[#080b15] rounded-2xl border border-white/10 px-4 py-1">
                {previousMonthsPending.length === 0 ? (
                  <p className="text-slate-400 text-center py-6 text-xs font-medium italic">All previous month accounts cleared! 🌟</p>
                ) : (
                  previousMonthsPending.map((set) => {
                    const fromG = groups.find(g => g.id === set.fromGroup);
                    const toG = groups.find(g => g.id === set.toGroup);
                    const getMonthLabel = (s: typeof set) => s.billingMonth ? formatMonthLabel(s.billingMonth) : (s.date ? formatMonthLabel(s.date.slice(0, 7)) : 'Past');

                    return (
                      <div key={set.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">
                            {fromG ? fromG.name.split(' (')[0] : 'Unknown'} ➔ {toG ? toG.name.split(' (')[0] : 'Unknown'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{set.notes || 'Group balancing settle'}</p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] bg-rose-500/10 text-rose-400 font-bold uppercase rounded-md border border-rose-500/20 mt-1 font-mono">
                            Due from {getMonthLabel(set)}
                          </span>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-3">
                          <div className="font-mono font-extrabold text-rose-400 text-sm">₹{set.amount.toLocaleString('en-IN')}</div>
                          <button
                            type="button"
                            id={`btn-settle-prev-${set.id}`}
                            disabled={isSyncing}
                            onClick={() => onMarkSettleCompleted(set.id)}
                            className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold font-mono cursor-pointer transition-all disabled:opacity-50"
                          >
                            Mark Paid
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Settled History */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <History className="size-5 text-emerald-400" />
            <h3 className="text-white font-extrabold font-sans text-base">Completed Settlement Archive</h3>
          </div>

          <div className="divide-y divide-white/5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {currentMonthSettledHistory.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-xs font-medium italic">No transaction history logged for this month.</p>
            ) : (
              currentMonthSettledHistory.map((set) => {
                const fromG = groups.find(g => g.id === set.fromGroup);
                const toG = groups.find(g => g.id === set.toGroup);

                return (
                  <div key={set.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">
                        {fromG ? fromG.name.split(' (')[0] : 'Unknown'} ➔ {toG ? toG.name.split(' (')[0] : 'Unknown'}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{set.notes || 'Cleared'}</p>
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-emerald-500/10 text-emerald-400 font-bold font-mono uppercase rounded-md border border-emerald-500/20 mt-1">
                        Settled OK
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-extrabold text-slate-200 text-sm">₹{set.amount.toLocaleString('en-IN')}</div>
                      <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Cleared on {set.settledAt?.split('T')[0] || set.date}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
