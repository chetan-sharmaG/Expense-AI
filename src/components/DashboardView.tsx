/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
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
  onNavigate: (tab: string) => void;
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

  // 2. User Wise Spend Breakdown
  const userSpendData = useMemo(() => {
    return users.map(u => {
      const uSpent = expenses
        .filter(exp => exp.paidBy === u.id)
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        name: u.name,
        amount: uSpent
      };
    }).filter(d => d.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [expenses, users]);

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
      {/* Welcome Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111420]/80 p-6 rounded-2xl text-white shadow-sm border border-white/5 relative overflow-hidden backdrop-blur-md">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight font-sans">
            {state.family.name}
          </h1>
          <p className="text-slate-355 text-sm mt-1 font-semibold">
            Private Multi-Group Family ledger, smart receipt scanner & balance settlements.
          </p>
        </div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500 rounded-full opacity-[0.03]"></div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Spending */}
        <div className="bg-[#111420]/80 p-5 rounded-2xl shadow-sm border border-white/5 flex items-center gap-4 hover:border-emerald-500/20 transition backdrop-blur-md">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-450">
            <DollarSign className="size-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Spending</p>
            <h3 className="text-2xl font-bold font-mono text-white mt-1">₹{totalSpend.toLocaleString('en-IN')}</h3>
            <p className="text-slate-550 text-xs mt-0.5 font-semibold">Across all registered groups</p>
          </div>
        </div>

        {/* Monthly Splurge */}
        <div className="bg-[#111420]/80 p-5 rounded-2xl shadow-sm border border-white/5 flex items-center gap-4 hover:border-emerald-500/20 transition backdrop-blur-md">
          <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400">
            <Calendar className="size-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">This Month</p>
            <h3 className="text-2xl font-bold font-mono text-white mt-1">₹{monthlyTotal.toLocaleString('en-IN')}</h3>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 mt-1">
              <TrendingUp className="size-2.5" /> Active Billing
            </span>
          </div>
        </div>

        {/* Groups Active */}
        <div className="bg-[#111420]/80 p-5 rounded-2xl shadow-sm border border-white/5 flex items-center gap-4 hover:border-emerald-500/20 transition backdrop-blur-md">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <Users className="size-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Active Groups</p>
            <h3 className="text-2xl font-bold font-mono text-white mt-1">{groups.length} Groups</h3>
            <p className="text-slate-555 text-xs mt-0.5 font-semibold">{users.length} Family members total</p>
          </div>
        </div>

        {/* Top Spending Segment */}
        <div className="bg-[#111420]/80 p-5 rounded-2xl shadow-sm border border-white/5 flex items-center gap-4 hover:border-emerald-500/20 transition backdrop-blur-md">
          <div className="p-3 bg-emerald-650/10 rounded-xl text-emerald-450">
            <ShoppingBag className="size-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Top Spend Segment</p>
            <h3 className="text-lg font-bold text-white truncate max-w-[170px] mt-1">
              {categorySpendData[0]?.name || 'No spend yet'}
            </h3>
            <p className="text-slate-555 text-xs mt-0.5 font-semibold">
              {categorySpendData[0] ? `₹${categorySpendData[0].value.toLocaleString('en-IN')} (${categorySpendData[0].percentage}%)` : 'Keep logging'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics promo card (2 columns on lg) */}
        <div className="bg-[#111420]/80 p-8 rounded-2xl border border-white/5 shadow-sm lg:col-span-2 flex flex-col justify-between backdrop-blur-md relative overflow-hidden group min-h-[300px]">
          <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 group-hover:opacity-10 transition-opacity">
            <PieIcon className="size-64 text-emerald-500" />
          </div>
          <div className="space-y-4 max-w-xl">
            <div className="size-12 rounded-xl bg-emerald-950/30 text-emerald-450 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="size-6" />
            </div>
            <div>
              <h3 className="text-white font-bold font-sans text-xl">Visual Spending Analytics</h3>
              <p className="text-slate-450 text-xs font-semibold leading-relaxed mt-2">
                Explore interactive breakdown charts of your family finances. Track monthly budgets, category-wise allocations, daily cumulative spline trends, and comparative sub-group contributions.
              </p>
            </div>
          </div>
          <div className="pt-6">
            <button
              onClick={() => onNavigate('analysis')}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Analytics & Trend Graphs</span>
              <ArrowUpRight className="size-4" />
            </button>
          </div>
        </div>

        {/* User Ranking (1 column on lg) */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm min-w-0 flex flex-col justify-between backdrop-blur-md">
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Individual Spenders</h3>
            <p className="text-slate-500 text-xs">Tracking individual spending transactions volume</p>
          </div>

          <div className="divide-y divide-white/5 flex-1 mt-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
            {userSpendData.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-xs">No users have spent money yet.</p>
            ) : (
              userSpendData.map((user) => {
                const percentage = totalSpend > 0 ? (user.amount / totalSpend) * 100 : 0;
                return (
                  <div key={user.name} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="size-8 rounded-full bg-[#090b11] flex items-center justify-center font-bold text-slate-350 text-sm border border-white/5">
                        {user.name[0]}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">{user.name}</h4>
                        <span className="text-[10px] text-slate-500 font-semibold">Contributor</span>
                      </div>
                    </div>
                    
                    <div className="hidden sm:block flex-1 max-w-[80px]">
                      <div className="w-full bg-[#090b11] rounded-full h-1 border border-white/5">
                        <div 
                          className="h-1 rounded-full bg-emerald-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-white">₹{user.amount.toLocaleString('en-IN')}</p>
                      <p className="text-[9px] text-slate-550 font-mono font-semibold">{Math.round(percentage)}% of total</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-white/5 text-center">
            <button 
              type="button"
              id="btn-navigate-expenses"
              onClick={() => onNavigate('expenses')} 
              className="text-xs text-emerald-450 hover:text-emerald-400 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              View entire logs ledger <ArrowUpRight className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly wise spends / Past Spends History */}
      <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm space-y-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-emerald-450" />
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Monthly Spending History</h3>
            <p className="text-slate-550 text-xs">Overview of monthly historical family spending logs</p>
          </div>
        </div>

        {monthlyWiseSpends.length === 0 ? (
          <p className="text-slate-500 text-center py-6 text-sm">No historical monthly spends recorded.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {monthlyWiseSpends.map((item, idx) => {
              const maxSpend = Math.max(...monthlyWiseSpends.map(m => m.amount));
              const relativePercentage = maxSpend > 0 ? (item.amount / maxSpend) * 100 : 0;
              
              return (
                <div key={item.key} className="bg-[#090b11]/60 p-4 rounded-xl border border-white/5 hover:border-emerald-500/30 transition flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">{item.monthName}</span>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      #{idx + 1}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold font-mono text-white">₹{item.amount.toLocaleString('en-IN')}</h4>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full bg-[#111420] rounded-full h-1.5 border border-white/5 overflow-hidden">
                      <div 
                        className="h-1.5 rounded-full bg-emerald-500" 
                        style={{ width: `${relativePercentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-550 font-mono font-bold block text-right">
                      {Math.round(relativePercentage)}% of peak month
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
