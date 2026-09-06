/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { DBState } from '../types';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  ShoppingBag,
  ArrowUpRight,
  Calendar,
  PieChart as PieIcon
} from 'lucide-react';

interface DashboardViewProps {
  state: DBState;
  onNavigate: (tab: string, stateData?: any) => void;
}

export default function DashboardView({ state, onNavigate }: DashboardViewProps) {
  const { expenses, groups, users } = state;

  // 1. Core Spend Metrics
  const totalSpend = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const activeMonthExpenses = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return expenses.filter(exp => exp.date.startsWith(currentMonth));
  }, [expenses]);

  const monthlyTotal = useMemo(() => {
    return activeMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [activeMonthExpenses]);

  // Spenders filter states
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  // Filter expenses matching the active selected billing period for leaderboard
  const filteredExpensesForRanking = useMemo(() => {
    if (selectedMonthFilter === 'overall') {
      return expenses;
    }
    return expenses.filter(exp => exp.date && exp.date.startsWith(selectedMonthFilter));
  }, [expenses, selectedMonthFilter]);

  const filteredTotalSpend = useMemo(() => {
    return filteredExpensesForRanking.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpensesForRanking]);

  // 2. User Wise Spend Breakdown
  const userSpendData = useMemo(() => {
    return users.map(u => {
      const uSpent = filteredExpensesForRanking
        .filter(exp => exp.paidBy === u.id)
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        name: u.name,
        amount: uSpent
      };
    }).filter(d => d.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [filteredExpensesForRanking, users]);

  // 3. Category-wise Spending
  const categorySpendData = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    expenses.forEach(exp => {
      categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
    });

    return Object.keys(categoryMap).map(cat => ({
      name: cat,
      value: categoryMap[cat],
      percentage: totalSpend > 0 ? Math.round((categoryMap[cat] / totalSpend) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [expenses, totalSpend]);

  // 4. Monthly Spending History
  const monthlyWiseSpends = useMemo(() => {
    const monthlyMap: { [key: string]: number } = {};
    expenses.forEach(exp => {
      if (!exp.date) return;
      const parts = exp.date.split('-');
      if (parts.length >= 2) {
        const year = parts[0];
        const month = parts[1];
        if (year.length === 4 && month.length === 2) {
          const yearMonth = `${year}-${month}`;
          monthlyMap[yearMonth] = (monthlyMap[yearMonth] || 0) + exp.amount;
          return;
        }
      }
      try {
        const d = new Date(exp.date);
        if (!isNaN(d.getTime())) {
          const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthlyMap[yearMonth] = (monthlyMap[yearMonth] || 0) + exp.amount;
        }
      } catch (e) {
        // ignore
      }
    });

    return Object.keys(monthlyMap)
      .sort((a, b) => b.localeCompare(a))
      .map(ym => {
        const [year, month] = ym.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        return {
          key: ym,
          monthName,
          amount: monthlyMap[ym]
        };
      });
  }, [expenses]);

  return (
    <div className="space-y-6">

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Monthly Splurge */}
        <div className="glass-card glass-card-hover p-6 rounded-3xl flex items-center gap-5 relative overflow-hidden group">
          <div className="size-14 bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Calendar className="size-7 stroke-[2.2]" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-wider font-semibold">Active Month Spending</p>
            <h3 className="text-3xl font-extrabold font-mono text-white mt-1 tracking-tight">₹{monthlyTotal.toLocaleString('en-IN')}</h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-2 font-mono">
              <TrendingUp className="size-3 text-emerald-400" /> Active Billing Month
            </span>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* Total Family Spend */}
        <div className="glass-card glass-card-hover p-6 rounded-3xl flex items-center gap-5 relative overflow-hidden group">
          <div className="size-14 bg-gradient-to-tr from-teal-500/20 to-amber-500/10 rounded-2xl text-teal-300 border border-teal-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <DollarSign className="size-7 stroke-[2.2]" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-wider font-semibold">All-Time Family Spend</p>
            <h3 className="text-3xl font-extrabold font-mono text-white mt-1 tracking-tight">₹{totalSpend.toLocaleString('en-IN')}</h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20 mt-2 font-mono">
              Cumulative Total Across Groups
            </span>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics promo card (2 columns on lg) */}
        <div 
          onClick={() => onNavigate('analysis')}
          className="glass-card glass-card-hover p-8 rounded-3xl lg:col-span-2 flex flex-col justify-between relative overflow-hidden group min-h-[300px] cursor-pointer"
        >
          <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 group-hover:opacity-20 transition-opacity">
            <PieIcon className="size-64 text-emerald-400" />
          </div>
          <div className="space-y-4 max-w-xl relative z-10">
            <div className="size-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-amber-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <TrendingUp className="size-7 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-white font-extrabold font-sans text-2xl tracking-tight gradient-text-aurora">Visual Spending Analytics</h3>
              <p className="text-slate-300 text-xs font-medium leading-relaxed mt-2.5">
                Explore interactive breakdown charts of your family finances. Track monthly budgets, category-wise allocations, daily cumulative spline trends, and comparative sub-group contributions.
              </p>
            </div>
          </div>
          <div className="pt-6 relative z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('analysis');
              }}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-2xl text-xs font-bold font-mono uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer hover:scale-[1.02]"
            >
              <span>View Analytics & Trend Graphs</span>
              <ArrowUpRight className="size-4 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* User Ranking (1 column on lg) */}
        <div className="glass-card p-6 rounded-3xl min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-white font-extrabold font-sans text-lg">Individual Spenders</h3>
              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="bg-[#090c19] border border-white/10 px-3 py-1.5 rounded-xl text-slate-200 text-xs font-mono font-bold focus:outline-none cursor-pointer"
              >
                <option value="overall" className="bg-[#0c0f1d] text-white">Overall (All-Time)</option>
                {monthOptions.map(ym => (
                  <option key={ym} value={ym} className="bg-[#0c0f1d] text-white">
                    {formatMonthLabel(ym)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-slate-400 text-xs mt-1 font-medium">Tracking individual spending transactions volume</p>
          </div>

          <div className="divide-y divide-white/5 flex-1 mt-3 max-h-[230px] overflow-y-auto pr-1 custom-scrollbar">
            {userSpendData.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-xs font-medium">No users have spent money in this period.</p>
            ) : (
              userSpendData.map((user) => {
                const percentage = filteredTotalSpend > 0 ? (user.amount / filteredTotalSpend) * 100 : 0;
                return (
                  <div key={user.name} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="size-9 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 flex items-center justify-center font-extrabold text-emerald-400 text-sm border border-emerald-500/20 font-mono">
                        {user.name[0]}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{user.name}</h4>
                        <span className="text-[10px] text-slate-400 font-semibold font-mono">Contributor</span>
                      </div>
                    </div>
                    
                    <div className="hidden sm:block flex-1 max-w-[80px]">
                      <div className="w-full bg-[#080b15] rounded-full h-1.5 border border-white/5 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-emerald-400" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-white">₹{user.amount.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-emerald-400/80 font-mono font-semibold">{Math.round(percentage)}% of total</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3.5 border-t border-white/10 text-center">
            <button 
              type="button"
              id="btn-navigate-expenses"
              onClick={() => onNavigate('expenses', { initialMonth: selectedMonthFilter })} 
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              View entire logs ledger <ArrowUpRight className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly wise spends / Past Spends History */}
      <div className="glass-card p-7 rounded-3xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <Calendar className="size-5" />
          </div>
          <div>
            <h3 className="text-white font-extrabold font-sans text-lg">Monthly Spending History</h3>
            <p className="text-slate-400 text-xs font-medium">Overview of monthly historical family spending logs</p>
          </div>
        </div>

        {monthlyWiseSpends.length === 0 ? (
          <p className="text-slate-500 text-center py-6 text-sm font-medium">No historical monthly spends recorded.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {monthlyWiseSpends.map((item, idx) => {
              const maxSpend = Math.max(...monthlyWiseSpends.map(m => m.amount));
              const relativePercentage = maxSpend > 0 ? (item.amount / maxSpend) * 100 : 0;
              
              return (
                <div key={item.key} className="glass-panel p-4 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-3 group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">{item.monthName}</span>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      #{idx + 1}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold font-mono text-white tracking-tight">₹{item.amount.toLocaleString('en-IN')}</h4>
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-full bg-[#080b15] rounded-full h-2 border border-white/5 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" 
                        style={{ width: `${relativePercentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold block text-right">
                      {Math.round(relativePercentage)}% of peak month
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="glass-card p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
            <DollarSign className="size-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-wider font-semibold">Total Family Expenditures</p>
            <h3 className="text-2xl font-extrabold font-mono text-white mt-0.5">₹{totalSpend.toLocaleString('en-IN')}</h3>
            <p className="text-slate-400 text-xs font-medium">Cumulative sum of all registered subgroups' transaction records</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('analysis')}
          className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold transition-all rounded-2xl text-xs flex items-center gap-2 cursor-pointer shadow-sm shrink-0 font-mono"
        >
          <span>View Analytics Breakdown</span>
          <ArrowUpRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
