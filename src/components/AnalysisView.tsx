/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { DBState } from '../types';
import { 
  TrendingUp, 
  PieChart as PieIcon, 
  Layers,
  Activity,
  Maximize2,
  Calendar,
  X
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
  AreaChart, 
  Area
} from 'recharts';

interface AnalysisViewProps {
  state: DBState;
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

export default function AnalysisView({ state }: AnalysisViewProps) {
  const { expenses, groups } = state;

  // 1. Total Spend
  const totalSpend = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

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

  // States for Allocation Month Selection & Splurge Modal
  const [selectedAllocationMonth, setSelectedAllocationMonth] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Available unique months list from expenses (YYYY-MM)
  const availableAllocationMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    expenses.forEach(exp => {
      if (exp.date) {
        monthsSet.add(exp.date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(monthsSet).sort().reverse(); // Newest first
  }, [expenses]);

  // Filtered expenses based on selection
  const filteredExpensesForAllocation = useMemo(() => {
    if (selectedAllocationMonth === 'all') return expenses;
    return expenses.filter(exp => exp.date && exp.date.startsWith(selectedAllocationMonth));
  }, [expenses, selectedAllocationMonth]);

  const filteredTotalSpendForAllocation = useMemo(() => {
    return filteredExpensesForAllocation.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpensesForAllocation]);

  // 3. Category-wise Spending
  const categorySpendData = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    filteredExpensesForAllocation.forEach(exp => {
      categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
    });

    return Object.keys(categoryMap).map(cat => ({
      name: cat,
      value: categoryMap[cat],
      percentage: filteredTotalSpendForAllocation > 0 ? Math.round((categoryMap[cat] / filteredTotalSpendForAllocation) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpensesForAllocation, filteredTotalSpendForAllocation]);

  // 4. Monthly Splurge Trend (Last 5 Months)
  const last5Months = useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = 4; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      months.push({ key, label });
    }
    return months;
  }, []);

  const splurgeTrendData = useMemo(() => {
    return last5Months.map(({ key, label }) => {
      const amount = expenses
        .filter(exp => exp.date && exp.date.startsWith(key))
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        date: label,
        amount
      };
    });
  }, [expenses, last5Months]);

  // All months trend data for popup
  const allAvailableMonths = useMemo(() => {
    if (expenses.length === 0) {
      const months = [];
      const today = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        months.push({ key, label });
      }
      return months;
    }

    // Find earliest expense date in expenses
    let earliestDate = new Date();
    expenses.forEach(exp => {
      if (exp.date) {
        const d = new Date(exp.date);
        if (d < earliestDate) {
          earliestDate = d;
        }
      }
    });

    const today = new Date();
    const months = [];
    let current = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);

    while (current <= today) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      const label = current.toLocaleString('default', { month: 'short', year: '2-digit' });
      months.push({ key, label });
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }, [expenses]);

  const splurgeTrendAllMonths = useMemo(() => {
    return allAvailableMonths.map(({ key, label }) => {
      const amount = expenses
        .filter(exp => exp.date && exp.date.startsWith(key))
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        date: label,
        amount
      };
    });
  }, [expenses, allAvailableMonths]);

  const totalAllTimeSpend = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const avgMonthlySpend = useMemo(() => {
    return splurgeTrendAllMonths.length > 0 ? Math.round(totalAllTimeSpend / splurgeTrendAllMonths.length) : 0;
  }, [splurgeTrendAllMonths, totalAllTimeSpend]);

  return (
    <div className="space-y-6">
      {/* Visual Analytics Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111420]/80 p-6 rounded-2xl text-white shadow-sm border border-white/5 relative overflow-hidden backdrop-blur-md">
        <div className="relative z-10">
          <h1 className="text-xl font-bold tracking-tight font-sans flex items-center gap-2">
            <Activity className="size-5 text-emerald-450" /> Spending Visual Analysis
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Track monthly cumulative spend trends, category budget shares, and sub-group contributions.
          </p>
        </div>
      </div>

      {/* Trend monthly and Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Area Chart (Left 2 Columns) - Clickable to open Modal */}
        <div 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm lg:col-span-2 min-w-0 space-y-4 backdrop-blur-md cursor-pointer hover:border-emerald-500/20 transition-all select-none group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold font-sans text-base">Expense Splurge Trend</h3>
                <Maximize2 className="size-3.5 text-slate-550 group-hover:text-emerald-450 transition-colors" />
              </div>
              <p className="text-slate-500 text-xs">Monthly spending trend over the last 5 months. Click to expand.</p>
            </div>
            <span className="text-xs bg-[#090b11]/80 border border-white/5 text-slate-400 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium font-mono">
              <TrendingUp className="size-3 text-emerald-400" /> INR (₹)
            </span>
          </div>

          <div className="h-56 sm:h-72 w-full">
            {expenses.length === 0 ? (
              <div className="text-center py-20 text-slate-500">No transactions recorded yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={splurgeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111420', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
                    labelStyle={{ fontWeight: 'bold', color: '#cbd5e1' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Spend']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpend)" name="Amount Spend" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown Donut (Right 1 Column) */}
        <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm flex flex-col justify-between min-w-0 space-y-4 backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <h3 className="text-white font-semibold font-sans text-base">Category Allocation</h3>
              <p className="text-slate-500 text-xs">Percentage distribution of family finances</p>
            </div>
            <select
              value={selectedAllocationMonth}
              onChange={(e) => setSelectedAllocationMonth(e.target.value)}
              onClick={(e) => e.stopPropagation()} // Prevent any parent clicks
              className="bg-[#090b11]/85 border border-white/5 text-slate-350 text-[11px] rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer shrink-0 max-w-[110px] truncate"
            >
              <option value="all">Overall</option>
              {availableAllocationMonths.map(m => {
                const [year, month] = m.split('-');
                const name = new Date(Number(year), Number(month) - 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' });
                return <option key={m} value={m}>{name}</option>;
              })}
            </select>
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

      {/* Group Contribution comparisons */}
      <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm min-w-0 space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Group Contribution & Spend Comparison</h3>
            <p className="text-slate-500 text-xs">Total volume mapped across family sub-groups (e.g. couples, parents)</p>
          </div>
          <Layers className="size-5 text-emerald-450" />
        </div>

        <div className="h-56 sm:h-72 w-full">
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

      {/* Group Budget Mapped Progress Meters */}
      <div className="bg-[#111420]/80 p-6 rounded-2xl border border-white/5 shadow-sm space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold font-sans text-base">Monthly Budget Targets & Consumption</h3>
            <p className="text-slate-500 text-xs font-semibold">Tracking active spending targets per family group</p>
          </div>
          <Activity className="size-5 text-emerald-450" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(grp => {
            const currentMonthExpenses = expenses.filter(exp => {
              if (exp.groupId !== grp.id) return false;
              const now = new Date();
              const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              return exp.date.startsWith(currentMonthPrefix);
            });
            const spentThisMonth = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            const budgetPercentage = grp.monthlyBudget && grp.monthlyBudget > 0 
              ? (spentThisMonth / grp.monthlyBudget) * 100 
              : 0;

            return (
              <div key={grp.id} className="bg-[#090b11]/40 p-4 rounded-xl border border-white/5 space-y-3 hover:border-emerald-500/20 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-200">{grp.name.split(' (')[0]}</span>
                  {grp.monthlyBudget && grp.monthlyBudget > 0 ? (
                    <span className="text-xs bg-[#111420] border border-white/5 text-slate-350 px-2 py-0.5 rounded-md font-mono">
                      Limit: ₹{grp.monthlyBudget.toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-550 italic font-semibold">No budget limit set</span>
                  )}
                </div>

                {grp.monthlyBudget && grp.monthlyBudget > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">
                        Spent: <b className="font-mono text-white">₹{spentThisMonth.toLocaleString('en-IN')}</b>
                      </span>
                      <span className={`font-bold font-mono text-xs ${budgetPercentage > 100 ? 'text-rose-455' : budgetPercentage > 75 ? 'text-amber-500' : 'text-emerald-450'}`}>
                        {Math.round(budgetPercentage)}%
                      </span>
                    </div>

                    <div className="w-full bg-[#111420] rounded-full h-1.5 border border-white/5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          budgetPercentage > 100 
                            ? 'bg-rose-500' 
                            : budgetPercentage > 75 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                      />
                    </div>

                    {budgetPercentage > 100 && (
                      <div className="text-[10px] text-rose-455 font-semibold flex items-center gap-1.5 animate-pulse bg-rose-955/20 border border-rose-900/30 p-1.5 rounded-lg">
                        ⚠️ Limit Exceeded! Splurge warning active for this subgroup.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">Set monthly limit under "Family & Groups" settings menu to track progress.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Splurge Modal Details */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090e]/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#111420] border border-white/5 rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col space-y-6 relative overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/5 pb-4 shrink-0">
              <div>
                <h3 className="text-white font-bold font-sans text-lg flex items-center gap-2">
                  <Activity className="size-5 text-emerald-450" /> Complete Spending Trend Breakdown
                </h3>
                <p className="text-slate-400 text-xs mt-0.5 font-semibold">
                  Historical month-on-month expense spline logs since first transaction.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-[#1a1e30] transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
              <div className="bg-[#090b11]/50 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Spent (All-Time)</span>
                <span className="text-lg font-bold text-white font-mono mt-1 block">₹{totalAllTimeSpend.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-[#090b11]/50 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Average Monthly Spend</span>
                <span className="text-lg font-bold text-emerald-450 font-mono mt-1 block">₹{avgMonthlySpend.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-[#090b11]/50 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tracked Months</span>
                <span className="text-lg font-bold text-white font-mono mt-1 block">{splurgeTrendAllMonths.length}</span>
              </div>
              <div className="bg-[#090b11]/50 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider block">Transactions Count</span>
                <span className="text-lg font-bold text-white font-mono mt-1 block">{expenses.length}</span>
              </div>
            </div>

            {/* Split layout: Chart vs Table */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* Detailed Chart (Left 3 cols) */}
              <div className="lg:col-span-3 h-64 lg:h-full min-h-[250px] bg-[#090b11]/20 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Visual Spline Curve</span>
                <div className="w-full flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={splurgeTrendAllMonths} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSpendAll" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111420', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
                        labelStyle={{ fontWeight: 'bold', color: '#cbd5e1' }}
                        formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Spend']}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpendAll)" name="Spend" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table / List View (Right 2 cols) */}
              <div className="lg:col-span-2 flex flex-col justify-between min-h-[250px] bg-[#090b11]/30 border border-white/5 rounded-2xl p-4 overflow-hidden">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-3 shrink-0">Statement Breakdown</span>
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                  {[...splurgeTrendAllMonths].reverse().map((item, idx) => {
                    const maxVal = Math.max(...splurgeTrendAllMonths.map(i => i.amount), 1);
                    const percentageWidth = Math.round((item.amount / maxVal) * 100);

                    return (
                      <div key={idx} className="bg-[#111420]/70 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <span className="text-xs font-bold text-slate-205 block">{item.date}</span>
                          <div className="w-full bg-[#090b11] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${percentageWidth}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-white font-mono">₹{item.amount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-white/5 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-sm"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
