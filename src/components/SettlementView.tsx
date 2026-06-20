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

  // Calculate balancing rules
  const { summaries, totalFamilySpend, proposals } = useMemo(() => {
    return calculateGroupSettlements(expenses, groups, splitMethod, users);
  }, [expenses, groups, splitMethod, users]);

  // Splitting settlements into Active (Pending) and History (Settled)
  const pendingSettlements = useMemo(() => {
    return settlements.filter(s => s.status === 'pending');
  }, [settlements]);

  const settledHistory = useMemo(() => {
    return settlements.filter(s => s.status === 'settled');
  }, [settlements]);

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
      notes: notesInput
    });

    setRegisteringProposal(null);
    setNotesInput('');
  };

  return (
    <div className="space-y-6">
      
      {/* Settings Row */}
      <div className="bg-[#111420]/80 p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
        <div>
          <h2 className="text-white font-bold font-sans text-lg">Group Settlement Engine</h2>
          <p className="text-slate-400 text-xs mt-0.5 font-semibold">Calculate fair fractional splits and balance liabilities between sub-family units.</p>
        </div>

        {/* Toggle algorithm buttons */}
        <div className="bg-[#090b11]/80 border border-white/5 p-1 rounded-xl flex items-center gap-1">
          <button
            type="button"
            id="btn-split-equal"
            onClick={() => setSplitMethod('equal_groups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              splitMethod === 'equal_groups' 
                ? 'bg-emerald-600 text-white shadow-sm font-semibold' 
                : 'text-slate-400 hover:text-slate-100 hover:bg-[#1a1e30]'
            }`}
          >
            Equal Split (By Groups)
          </button>
          <button
            type="button"
            id="btn-split-members"
            onClick={() => setSplitMethod('member_count')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              splitMethod === 'member_count' 
                ? 'bg-emerald-600 text-white shadow-sm font-semibold' 
                : 'text-slate-400 hover:text-slate-100 hover:bg-[#1a1e30]'
            }`}
          >
            Weighted Split (By Member Count)
          </button>
        </div>
      </div>

      {/* Main calculation breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ledger Balance Sheet (Left 2 Columns) */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm lg:col-span-2 min-w-0 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold font-sans text-base">Ledger Balance Sheet</h3>
            <span className="text-xs text-slate-500 font-bold">Total Pool spending: <b className="font-mono text-slate-300">₹{totalFamilySpend.toLocaleString('en-IN')}</b></span>
          </div>

          <div>
            {/* Desktop Balance Sheet Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[#090b11]/45 border-b border-white/5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Subgroup / Unit</th>
                    <th className="py-3 px-4 text-right">Total Spent</th>
                    <th className="py-3 px-4 text-right">Target Fair share</th>
                    <th className="py-3 px-4 text-right">Net Balance Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summaries.map((summary) => {
                    const isDebtor = summary.netBalance < 0;
                    const absVal = Math.abs(summary.netBalance);
                    
                    return (
                      <tr key={summary.groupId} className="hover:bg-[#090b11]/30 transition">
                        <td className="py-4 px-4">
                          <span className="font-semibold text-slate-200 block">{summary.groupName}</span>
                          {splitMethod === 'member_count' && (
                            <span className="text-[10px] text-slate-500 font-bold mt-0.5 block">
                              {users.filter(u => u.groupId === summary.groupId).length} members assigned
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-white">
                          ₹{summary.totalSpent.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-slate-400">
                          ₹{summary.fairShare.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-right font-mono">
                          {summary.netBalance === 0 ? (
                            <span className="text-slate-400 font-bold text-xs">Balanced</span>
                          ) : isDebtor ? (
                            <span className="text-rose-400 font-bold bg-rose-950/20 border border-rose-900/20 px-2 py-1 rounded inline-flex items-center gap-1 text-xs">
                              <TrendingDown className="size-3" /> Owes ₹{absVal.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-emerald-450 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded inline-flex items-center gap-1 text-xs">
                              <TrendingUp className="size-3" /> Receives ₹{absVal.toLocaleString('en-IN')}
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
                        <span className="font-semibold text-slate-200 text-sm block">{summary.groupName}</span>
                        {splitMethod === 'member_count' && (
                          <span className="text-[10px] text-slate-500 font-bold mt-0.5 block">
                            {users.filter(u => u.groupId === summary.groupId).length} members assigned
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 font-mono">
                        {summary.netBalance === 0 ? (
                          <span className="text-slate-400 text-xs font-bold bg-[#090b11] border border-white/5 px-2.5 py-1 rounded">Balanced</span>
                        ) : isDebtor ? (
                          <span className="text-rose-400 font-bold bg-rose-950/20 px-2.5 py-1 rounded inline-flex items-center gap-1 text-xs border border-rose-900/20">
                            <TrendingDown className="size-3" /> Owes ₹{absVal.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-emerald-455 font-bold bg-emerald-500/10 px-2.5 py-1 rounded inline-flex items-center gap-1 text-xs border border-emerald-500/15">
                            <TrendingUp className="size-3" /> Receives ₹{absVal.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-[#090b11]/60 p-3 rounded-xl border border-white/5 text-xs">
                      <div>
                        <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wide">Total Spent</span>
                        <span className="font-mono font-bold text-white text-sm mt-0.5 block">₹{summary.totalSpent.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wide">Target Share</span>
                        <span className="font-mono text-slate-400 text-sm mt-0.5 block">₹{summary.fairShare.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#090b11]/60 p-4 rounded-xl text-xs text-slate-400 flex items-start gap-2.5 leading-relaxed border border-white/5">
            <Scale className="size-4 text-emerald-450 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">How this settlement is calculated:</p>
              {splitMethod === 'equal_groups' ? (
                <p className="mt-1 text-slate-450 font-semibold">
                  1. The total pool spending (₹{totalFamilySpend}) is distributed equally across all active groups.
                  2. Your group is credited for the payments you made. 
                  3. If you spent more than your share, you receive the difference. If you spent less, you pay the difference.
                </p>
              ) : (
                <p className="mt-1 text-slate-450 font-semibold">
                  1. The total spending (₹{totalFamilySpend}) is divided based on the number of individual members inside each group relative to active family capacity.
                  2. This weights larger group structures (e.g., family houses or multiple people) with a proportional share while keeping single spend units fair.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Suggested Payments Proposals (Right Column) */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm flex flex-col justify-between backdrop-blur-md">
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Recommended Clearing Payments</h3>
            <p className="text-slate-500 text-xs mt-0.5">Automated path of transactions to reach zero-debt balance.</p>
          </div>

          <div className="flex-1 mt-4 space-y-3.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {proposals.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="size-10 stroke-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-205 mt-2">All accounts balanced!</p>
                <p className="text-xs text-slate-500 mt-1">No settlement payments required.</p>
              </div>
            ) : (
              proposals.map((prop, idx) => (
                <div key={`${prop.fromGroupId}-${prop.toGroupId}-${idx}`} className="p-4 bg-[#090b11]/80 border border-white/5 rounded-2xl relative flex flex-col justify-between hover:border-emerald-500/25 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">From Debtor</span>
                      <span className="text-xs font-bold text-rose-400">{prop.fromGroupName.split(' (')[0]}</span>
                    </div>
                    
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-xs font-extrabold font-mono text-emerald-450">₹{prop.amount.toLocaleString('en-IN')}</span>
                      <ArrowRight className="size-4 text-slate-500 mt-1" />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">To Creditor</span>
                      <span className="text-xs font-bold text-emerald-400">{prop.toGroupName.split(' (')[0]}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold">Bypasses secondary debts</span>
                    <button
                      type="button"
                      id={`btn-reg-prop-${idx}`}
                      disabled={isSyncing}
                      onClick={() => handleOpenRegister(prop)}
                      className="px-2.5 py-1 bg-[#1a1e30] hover:bg-[#252b44] text-slate-200 border border-white/5 font-bold transition rounded-lg text-[10px] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Record Transaction
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="border-t border-white/5 pt-3 mt-4 text-center">
            <span className="text-[10px] text-emerald-450 font-bold">Simplification math engine configured 🚀</span>
          </div>
        </div>

      </div>

      {/* Registers pop-up */}
      {registeringProposal && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#111420] rounded-3xl p-6 shadow-2xl border border-white/5 max-w-sm w-full mx-auto animate-fade-in">
            <h4 className="text-white font-bold font-sans text-base">Record Settlement Debt Payment</h4>
            <p className="text-slate-400 text-xs mt-1 font-semibold">
              Store this transaction in the ledger system as "Pending Verification" until confirming with actual banking receipts.
            </p>

            <div className="my-4 bg-[#090b11] p-4 rounded-2xl space-y-2 border border-white/5 text-sm">
              <p className="flex justify-between items-center text-slate-400">
                <span>Paying Group:</span>
                <span className="font-bold text-rose-400">{registeringProposal.fromGroupName.split(' (')[0]}</span>
              </p>
              <p className="flex justify-between items-center text-slate-400">
                <span>Receiving Group:</span>
                <span className="font-bold text-emerald-450">{registeringProposal.toGroupName.split(' (')[0]}</span>
              </p>
              <p className="flex justify-between items-center pt-2 border-t border-white/5 text-lg font-bold text-white font-mono">
                <span>Amount:</span>
                <span>₹{registeringProposal.amount.toLocaleString('en-IN')}</span>
              </p>
            </div>

            {/* Note entry */}
            <div className="space-y-1">
              <label htmlFor="proposal-notes" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Internal Notes</label>
              <input 
                type="text" 
                id="proposal-notes"
                disabled={isSyncing}
                value={notesInput} 
                onChange={(e) => setNotesInput(e.target.value)} 
                className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-close-register"
                disabled={isSyncing}
                onClick={() => setRegisteringProposal(null)}
                className="px-3.5 py-1.5 bg-[#1a1e30] hover:bg-[#252b44] text-slate-300 text-xs rounded-xl font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Go Back
              </button>
              <button
                type="button"
                id="btn-confirm-register"
                disabled={isSyncing}
                onClick={handleConfirmRegister}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl font-bold cursor-pointer transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <span className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Logging...</span>
                  </>
                ) : (
                  <span>Log Registry</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlements Lists Panels (Pending vs History) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pending Settlements */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm space-y-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-500" />
            <h3 className="text-white font-semibold font-sans text-base">Unsettled / Pending Settlements</h3>
          </div>

          <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {pendingSettlements.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-xs font-semibold">No pending transactions registered.</p>
            ) : (
              pendingSettlements.map((set) => {
                const fromG = groups.find(g => g.id === set.fromGroup);
                const toG = groups.find(g => g.id === set.toGroup);

                return (
                  <div key={set.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">
                        {fromG ? fromG.name.split(' (')[0] : 'Unknown'} ➔ {toG ? toG.name.split(' (')[0] : 'Unknown'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">{set.notes || 'Group balancing settle'}</p>
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-amber-950/20 text-amber-500 font-bold uppercase rounded border border-amber-900/30 mt-1">
                        Pending payment
                      </span>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div className="font-mono font-bold text-white text-sm">₹{set.amount.toLocaleString('en-IN')}</div>
                      <button
                        type="button"
                        id={`btn-settle-${set.id}`}
                        disabled={isSyncing}
                        onClick={() => onMarkSettleCompleted(set.id)}
                        className="px-2.5 py-1 bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 rounded-lg text-[10px] font-bold cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Settle Paid
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Settled History */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm space-y-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <History className="size-5 text-emerald-500" />
            <h3 className="text-white font-semibold font-sans text-base">Completed Settlement Archive</h3>
          </div>

          <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {settledHistory.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-xs font-semibold">No transaction history in ledger logs.</p>
            ) : (
              settledHistory.map((set) => {
                const fromG = groups.find(g => g.id === set.fromGroup);
                const toG = groups.find(g => g.id === set.toGroup);

                return (
                  <div key={set.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300">
                        {fromG ? fromG.name.split(' (')[0] : 'Unknown'} ➔ {toG ? toG.name.split(' (')[0] : 'Unknown'}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-bold">{set.notes || 'Cleared'}</p>
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-emerald-950/20 text-emerald-400 font-bold uppercase rounded border border-emerald-900/30 mt-1">
                        Settled OK
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-slate-400 text-sm">₹{set.amount.toLocaleString('en-IN')}</div>
                      <span className="text-[9px] text-slate-500 font-mono font-medium block mt-0.5">Cleared on {set.settledAt?.split('T')[0] || set.date}</span>
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
