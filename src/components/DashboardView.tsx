/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { DBState, Expense, Group, User } from '../types';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Layers, 
  PieChart as PieIcon, 
  ShoppingBag,
  ArrowUpRight,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area
} from 'recharts';

interface DashboardViewProps {
  state: DBState;
  onNavigate: (tab: string) => void;
}

const COLORS = [
  '#10b981', // Emerald 500
  '#0d9488', // Teal 600
  '#f59e0b', // Amber 500
  '#059669', // Emerald 600
  '#0f766e', // Teal 700
  '#d97706', // Amber 600
  '#34d399', // Emerald 400
  '#14b8a6', // Teal 500
];

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

  // 2. Group Wise Spend Breakdown
  const groupSpendData = useMemo(() => {
    return groups.map(g => {
      const gSpent = expenses
        .filter(exp => exp.groupId === g.id)
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        name: g.name.split(' (')[0], // Trim subtexts for charts
        amount: gSpent,
        percentage: totalSpend > 0 ? Math.round((gSpent / totalSpend) * 100) : 0
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [expenses, groups, totalSpend]);

  // 3. User Wise Spend Breakdown
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

  // 4. Category-wise Spending
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

  // 5. Daily Spending Trends (Past 10 Days of logged activities)
  const dailyTrendData = useMemo(() => {
    const dailyMap: { [key: string]: number } = {};
    // Grab past 10 calendar dates with expenses, or last 10 days
    const pastDates = Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    pastDates.forEach(date => {
      dailyMap[date] = 0;
    });

    expenses.forEach(exp => {
      if (dailyMap[exp.date] !== undefined) {
        dailyMap[exp.date] += exp.amount;
      } else {
        // If outside 10 days, but we want to show it if date is close
        const dateObj = new Date(exp.date);
        const diffTime = Math.abs(new Date().getTime() - dateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 14) {
          dailyMap[exp.date] = (dailyMap[exp.date] || 0) + exp.amount;
        }
      }
    });

    return Object.keys(dailyMap).sort().map(date => {
      // Format to readable: e.g. "12 Jun"
      const parts = date.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]} ${new Date(date).toLocaleString('default', { month: 'short' })}` : date;
      return {
        date: formattedDate,
        amount: dailyMap[date]
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
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-450 rounded-full text-xs font-semibold shrink-0">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            WhatsApp Bot Active
          </div>
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
          <div className="p-3 bg-emerald-600/10 rounded-xl text-emerald-400">
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

      {/* Main Charts & Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Area Chart (Left 2 Columns) */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm lg:col-span-2 min-w-0 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold font-sans text-base">Expense Splurge Trend</h3>
              <p className="text-slate-500 text-xs">Daily cumulative spending logs inside the last 10 tracked days</p>
            </div>
            <span className="text-xs bg-[#090b11]/80 border border-white/5 text-slate-400 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium font-mono">
              <TrendingUp className="size-3 text-emerald-400" /> INR (₹)
            </span>
          </div>

          <div className="h-56 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111420', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
                  labelStyle={{ fontWeight: 'bold', color: '#cbd5e1' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpend)" name="Amount Spend" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Donut (Right 1 Column) */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm flex flex-col justify-between min-w-0 space-y-4 backdrop-blur-md">
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Category Allocation</h3>
            <p className="text-slate-500 text-xs">Percentage distribution of overall family finances</p>
          </div>

          <div className="h-56 relative flex items-center justify-center">
            {categorySpendData.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <PieIcon className="size-12 mx-auto stroke-slate-800" />
                <p className="text-xs mt-2">No logging details found yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySpendData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categorySpendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111420', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
                    formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN')}`} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {categorySpendData.length > 0 && (
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-500 font-medium font-sans uppercase tracking-wider font-semibold">Top Share</span>
                <span className="text-base font-bold text-emerald-450 font-mono mt-0.5">
                  {categorySpendData[0]?.percentage}%
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs overflow-y-auto max-h-36 pr-1 custom-scrollbar">
            {categorySpendData.slice(0, 6).map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-1.5 truncate">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-slate-300 truncate font-semibold">{entry.name}</span>
                <span className="text-slate-550 font-mono shrink-0">({entry.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Group and User Spend Aggregations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Group Comparison (Bar Chart) */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm min-w-0 space-y-4 backdrop-blur-md">
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Group Contribution & Spend Comparison</h3>
            <p className="text-slate-500 text-xs">Total volume mapped across family sub-groups (e.g. couples, parents)</p>
          </div>

          <div className="h-52 sm:h-64 w-full">
            {groupSpendData.length === 0 ? (
              <p className="text-slate-500 text-center py-16 text-sm">No group data mapped.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupSpendData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" fontSize={11} stroke="#475569" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="#475569" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111420', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
                    formatter={(v) => `₹${v.toLocaleString('en-IN')}`} 
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]} name="Spent">
                    {groupSpendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* User Ranking (Horizontal List) */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm min-w-0 space-y-4 flex flex-col justify-between backdrop-blur-md">
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Individual Spenders</h3>
            <p className="text-slate-500 text-xs">Tracking individual spending transactions volume</p>
          </div>

          <div className="divide-y divide-white/5 flex-1 mt-2">
            {userSpendData.length === 0 ? (
              <p className="text-slate-500 text-center py-16 text-sm">No users have spent money yet.</p>
            ) : (
              userSpendData.map((user, idx) => {
                const percentage = totalSpend > 0 ? (user.amount / totalSpend) * 100 : 0;
                return (
                  <div key={user.name} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="size-8 rounded-full bg-[#090b11] flex items-center justify-center font-bold text-slate-350 text-sm border border-white/5">
                        {user.name[0]}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">{user.name}</h4>
                        <span className="text-[11px] text-slate-500 font-semibold">Contributor</span>
                      </div>
                    </div>
                    
                    <div className="hidden xs:block flex-1 max-w-[80px] sm:max-w-[200px]">
                      <div className="w-full bg-[#090b11] rounded-full h-1.5 border border-white/5">
                        <div 
                          className="h-1.5 rounded-full bg-emerald-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-white">₹{user.amount.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-500 font-mono font-bold">{Math.round(percentage)}% of family total</p>
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

    </div>
  );
}
