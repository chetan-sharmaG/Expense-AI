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
}

export default function SettlementView({ 
  state, 
  onAddSettlement, 
  onMarkSettleCompleted,
  onDeleteSettlement
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
      <div className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold font-sans text-lg">Group Settlement Engine</h2>
          <p className="text-slate-500 text-xs mt-0.5">Calculate fair fractional splits and balance liabilities between sub-family units.</p>
        </div>

        {/* Toggle algorithm buttons */}
        <div className="bg-slate-950 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
          <button
            type="button"
            id="btn-split-equal"
            onClick={() => setSplitMethod('equal_groups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              splitMethod === 'equal_groups' 
                ? 'bg-indigo-600 text-white shadow-sm font-semibold' 
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
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
                ? 'bg-indigo-600 text-white shadow-sm font-semibold' 
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            Weighted Split (By Member Count)
          </button>
        </div>
      </div>

      {/* Main calculation breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ledger Balance Sheet (Left 2 Columns) */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm lg:col-span-2 min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold font-sans text-base">Ledger Balance Sheet</h3>
            <span className="text-xs text-slate-505 font-semibold">Total Pool spending: <b className="font-mono text-slate-350">₹{totalFamilySpend.toLocaleString('en-IN')}</b></span>
          </div>

          <div>
            {/* Desktop Balance Sheet Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-850 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Subgroup / Unit</th>
                    <th className="py-3 px-4 text-right">Total Spent</th>
                    <th className="py-3 px-4 text-right">Target Fair share</th>
                    <th className="py-3 px-4 text-right">Net Balance Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {summaries.map((summary) => {
                    const isDebtor = summary.netBalance < 0;
                    const absVal = Math.abs(summary.netBalance);
                    
                    return (
                      <tr key={summary.groupId} className="hover:bg-slate-950/40 transition">
                        <td className="py-4 px-4">
                          <span className="font-semibold text-slate-200 block">{summary.groupName}</span>
                          {splitMethod === 'member_count' && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              {users.filter(u => u.groupId === summary.groupId).length} members assigned
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-white">
                          ₹{summary.totalSpent.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-slate-405">
                          ₹{summary.fairShare.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-right font-mono">
                          {summary.netBalance === 0 ? (
                            <span className="text-slate-400 font-bold">Balanced</span>
                          ) : isDebtor ? (
                            <span className="text-rose-400 font-bold bg-rose-950/20 px-2 py-1 rounded inline-flex items-center gap-1 text-xs">
                              <TrendingDown className="size-3" /> Owes ₹{absVal.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold bg-emerald-950/20 px-2 py-1 rounded inline-flex items-center gap-1 text-xs">
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
            <div className="block md:hidden divide-y divide-slate-850">
              {summaries.map((summary) => {
                const isDebtor = summary.netBalance < 0;
                const absVal = Math.abs(summary.netBalance);
                
                return (
                  <div key={summary.groupId} className="py-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-semibold text-slate-200 text-sm block">{summary.groupName}</span>
                        {splitMethod === 'member_count' && (
                          <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                            {users.filter(u => u.groupId === summary.groupId).length} members assigned
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 font-mono">
                        {summary.netBalance === 0 ? (
                          <span className="text-slate-400 text-xs font-bold bg-slate-950 px-2.5 py-1 rounded">Balanced</span>
                        ) : isDebtor ? (
                          <span className="text-rose-400 font-bold bg-rose-955/20 px-2.5 py-1 rounded inline-flex items-center gap-1 text-xs border border-rose-950/30">
                            <TrendingDown className="size-3" /> Owes ₹{absVal.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold bg-emerald-955/20 px-2.5 py-1 rounded inline-flex items-center gap-1 text-xs border border-emerald-950/30">
                            <TrendingUp className="size-3" /> Receives ₹{absVal.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-955/45 p-3 rounded-xl border border-slate-850/60 text-xs">
                      <div>
                        <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wide">Total Spent</span>
                        <span className="font-mono font-bold text-white text-sm mt-0.5 block">₹{summary.totalSpent.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wide">Target Fair Share</span>
                        <span className="font-mono text-slate-400 text-sm mt-0.5 block">₹{summary.fairShare.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-950/40 p-4 rounded-xl text-xs text-slate-400 flex items-start gap-2.5 leading-relaxed border border-slate-800">
            <Scale className="size-4 text-indigo-450 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">How this settlement is calculated:</p>
              {splitMethod === 'equal_groups' ? (
                <p className="mt-1 text-slate-450">
                  1. The total pool spending (₹{totalFamilySpend}) is distributed equally across all active groups.
                  2. Your group is credited for the payments you made. 
                  3. If you spent more than your share, you receive the difference. If you spent less, you pay the difference.
                </p>
              ) : (
                <p className="mt-1 text-slate-450">
                  1. The total spending (₹{totalFamilySpend}) is divided based on the number of individual members inside each group relative to active family capacity.
                  2. This weights larger group structures (e.g., family houses or multiple people) with a proportional share while keeping single spend units fair.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Suggested Payments Proposals (Right Column) */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Recommended Clearing Payments</h3>
            <p className="text-slate-500 text-xs mt-0.5">Automated path of transactions to reach zero-debt balance.</p>
          </div>

          <div className="flex-1 mt-4 space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {proposals.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="size-10 stroke-emerald-505 mx-auto" />
                <p className="text-sm font-semibold text-slate-200 mt-2">All accounts balanced!</p>
                <p className="text-xs text-slate-500 mt-1">No settlement payments required.</p>
              </div>
            ) : (
              proposals.map((prop, idx) => (
                <div key={`${prop.fromGroupId}-${prop.toGroupId}-${idx}`} className="p-4 bg-slate-950 border border-slate-850 rounded-xl relative flex flex-col justify-between hover:border-slate-800 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">From Debtor</span>
                      <span className="text-xs font-semibold text-rose-400">{prop.fromGroupName.split(' (')[0]}</span>
                    </div>
                    
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-xs font-bold font-mono text-indigo-400">₹{prop.amount.toLocaleString('en-IN')}</span>
                      <ArrowRight className="size-4 text-slate-500 mt-1" />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">To Creditor</span>
                      <span className="text-xs font-semibold text-emerald-400">{prop.toGroupName.split(' (')[0]}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">Bypasses secondary debts</span>
                    <button
                      type="button"
                      id={`btn-reg-prop-${idx}`}
                      onClick={() => handleOpenRegister(prop)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold transition rounded text-[10px] cursor-pointer"
                    >
                      Record Transaction
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="border-t border-slate-850 pt-3 mt-4 text-center">
            <span className="text-[10px] text-indigo-400 font-medium">Simplification math engine configured 🚀</span>
          </div>
        </div>

      </div>

      {/* Registers pop-up */}
      {registeringProposal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800 max-w-sm w-full mx-auto">
            <h4 className="text-white font-bold font-sans text-base">Record Settlement Debt Payment</h4>
            <p className="text-slate-500 text-xs mt-1">
              Store this transaction in the ledger system as "Pending Verification" until confirming with actual banking receipts.
            </p>

            <div className="my-4 bg-slate-950 p-4 rounded-xl space-y-2 border border-slate-800/60 text-sm">
              <p className="flex justify-between items-center text-slate-400">
                <span>Paying Group:</span>
                <span className="font-bold text-rose-450">{registeringProposal.fromGroupName.split(' (')[0]}</span>
              </p>
              <p className="flex justify-between items-center text-slate-400">
                <span>Receiving Group:</span>
                <span className="font-bold text-emerald-450">{registeringProposal.toGroupName.split(' (')[0]}</span>
              </p>
              <p className="flex justify-between items-center pt-2 border-t border-slate-800 text-lg font-bold text-white font-mono">
                <span>Amount:</span>
                <span>₹{registeringProposal.amount.toLocaleString('en-IN')}</span>
              </p>
            </div>

            {/* Note entry */}
            <div className="space-y-1">
              <label htmlFor="proposal-notes" className="text-xs font-bold text-slate-400 uppercase">Internal Notes</label>
              <input 
                type="text" 
                id="proposal-notes"
                value={notesInput} 
                onChange={(e) => setNotesInput(e.target.value)} 
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-close-register"
                onClick={() => setRegisteringProposal(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-350 text-xs rounded-lg font-bold cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                id="btn-confirm-register"
                onClick={handleConfirmRegister}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-bold cursor-pointer transition shadow-sm"
              >
                Log Registry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlements Lists Panels (Pending vs History) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pending Settlements */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-500" />
            <h3 className="text-white font-semibold font-sans text-base">Unsettled / Pending Settlements</h3>
          </div>

          <div className="divide-y divide-slate-850 max-h-[300px] overflow-y-auto pr-1">
            {pendingSettlements.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-xs">No pending transactions registered.</p>
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
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">{set.notes || 'Group balancing settle'}</p>
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-amber-950/20 text-amber-400 font-bold uppercase rounded border border-amber-900/30 mt-1">
                        Pending payment
                      </span>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div className="font-mono font-bold text-white text-sm">₹{set.amount.toLocaleString('en-IN')}</div>
                      <button
                        type="button"
                        id={`btn-settle-${set.id}`}
                        onClick={() => onMarkSettleCompleted(set.id)}
                        className="px-2.5 py-1 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-900/50 rounded text-[10px] font-bold cursor-pointer transition"
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
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <History className="size-5 text-emerald-500" />
            <h3 className="text-white font-semibold font-sans text-base">Completed Settlement Archive</h3>
          </div>

          <div className="divide-y divide-slate-850 max-h-[300px] overflow-y-auto pr-1">
            {settledHistory.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-xs">No transaction history in ledger logs.</p>
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
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{set.notes || 'Cleared'}</p>
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
