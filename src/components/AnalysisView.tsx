/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DBState } from '../types';
import AnimatedCounter from './AnimatedCounter';
import { 
  TrendingUp, 
  PieChart as PieIcon, 
  Layers,
  Activity,
  Maximize2,
  Calendar,
  X,
  Flame,
  Zap,
  LineChart as LineIcon
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
  Area,
  LineChart,
  Line,
  Legend
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
  '#fbbf24', // Amber 400
  '#10b981',
];

export default function AnalysisView({ state }: AnalysisViewProps) {
  const { expenses, groups } = state;
  const navigate = useNavigate();

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
        id: g.id,
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

  // 5. Category vs Time Stacked Area Chart (Last 6 Months)
  const last6Months = useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      const label = d.toLocaleString('default', { month: 'short' });
      months.push({ key, label });
    }
    return months;
  }, []);

  // Top 5 categories overall
  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
  }, [expenses]);

  const stackedCategoryTrendData = useMemo(() => {
    return last6Months.map(({ key, label }) => {
      const monthExpenses = expenses.filter(exp => exp.date && exp.date.startsWith(key));
      const row: Record<string, any> = { month: label };
      
      topCategories.forEach(cat => {
        const catAmount = monthExpenses
          .filter(e => e.category === cat)
          .reduce((sum, e) => sum + e.amount, 0);
        row[cat] = catAmount;
      });

      // Group remaining categories into 'Other'
      const otherAmount = monthExpenses
        .filter(e => !topCategories.includes(e.category))
        .reduce((sum, e) => sum + e.amount, 0);
      row['Other'] = otherAmount;

      return row;
    });
  }, [expenses, last6Months, topCategories]);

  // 6. Budget Burn-Down / Daily Spend Pace Spline (Active Month)
  const burnDownData = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayDate = now.getDate();

    // Total monthly budget target (sum of group budgets)
    const totalGroupBudget = groups.reduce((sum, g) => sum + (g.monthlyBudget || 0), 0) || 50000;

    const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(currentMonthKey));

    const result = [];
    let runningSpend = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${currentMonthKey}-${String(day).padStart(2, '0')}`;
      const dayTotal = monthExpenses
        .filter(e => e.date === dayStr)
        .reduce((sum, e) => sum + e.amount, 0);

      if (day <= todayDate) {
        runningSpend += dayTotal;
      }

      const targetPace = Math.round((day / daysInMonth) * totalGroupBudget);

      result.push({
        day: `Day ${day}`,
        dayNum: day,
        actual: day <= todayDate ? runningSpend : null,
        targetPace: targetPace
      });
    }

    return {
      data: result,
      totalBudget: totalGroupBudget,
      currentSpend: runningSpend,
      todayDate
    };
  }, [expenses, groups]);

  // 7. Day-of-Week Heatmap & Splurge Analysis
  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    filteredExpensesForAllocation.forEach(exp => {
      if (exp.date) {
        const d = new Date(exp.date);
        if (!isNaN(d.getTime())) {
          const dayIdx = d.getDay();
          dayTotals[dayIdx] += exp.amount;
          dayCounts[dayIdx] += 1;
        }
      }
    });

    const maxTotal = Math.max(...dayTotals, 1);
    const totalAll = dayTotals.reduce((a, b) => a + b, 0);

    return days.map((dayName, idx) => {
      const amount = dayTotals[idx];
      const count = dayCounts[idx];
      const percentage = totalAll > 0 ? Math.round((amount / totalAll) * 100) : 0;
      const intensity = Math.round((amount / maxTotal) * 100);
      return {
        dayName,
        dayIdx: idx,
        amount,
        count,
        percentage,
        intensity,
        isWeekend: idx === 0 || idx === 6
      };
    });
  }, [filteredExpensesForAllocation]);

  // Find Peak Splurge Day
  const peakSplurgeDay = useMemo(() => {
    let maxItem = dayOfWeekData[0];
    dayOfWeekData.forEach(item => {
      if (item.amount > maxItem.amount) {
        maxItem = item;
      }
    });
    return maxItem;
  }, [dayOfWeekData]);

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

  // Click handlers to navigate to ledger with filters
  const handleCategoryClick = (categoryName: string) => {
    navigate('/expenses', {
      state: {
        initialCategory: categoryName,
        initialMonth: selectedAllocationMonth
      }
    });
  };

  const handleGroupClick = (groupId: string) => {
    navigate('/expenses', {
      state: {
        initialGroup: groupId
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Visual Analytics Title Banner */}
      <div className="glass-card p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden border border-white/10">
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold tracking-tight font-sans flex items-center gap-2.5 gradient-text-aurora">
            <Activity className="size-6 text-emerald-400" /> Spending Visual Analysis
          </h1>
          <p className="text-slate-300 text-xs mt-1.5 font-medium">
            Track monthly cumulative spend trends, category allocation stacks, daily spending pace, and weekday splurge heatmaps.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 relative z-10">
          <div className="bg-[#080b15] border border-white/10 px-4 py-2 rounded-2xl text-right">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Total Tracked Spend</span>
            <AnimatedCounter value={totalSpend} className="text-lg font-extrabold text-emerald-400 font-mono" />
          </div>
        </div>
      </div>

      {/* Trend monthly and Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Area Chart (Left 2 Columns) - Clickable to open Modal */}
        <div 
          onClick={() => setIsModalOpen(true)}
          className="glass-card glass-card-hover p-7 rounded-3xl lg:col-span-2 min-w-0 space-y-5 cursor-pointer select-none group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-extrabold font-sans text-lg">Expense Splurge Trend</h3>
                <Maximize2 className="size-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <p className="text-slate-400 text-xs mt-0.5 font-medium">Monthly spending trend over the last 5 months. Click to expand.</p>
            </div>
            <span className="text-xs bg-[#090c19] border border-white/10 text-emerald-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold font-mono">
              <TrendingUp className="size-3.5 text-emerald-400" /> INR (₹)
            </span>
          </div>

          <div className="h-60 sm:h-72 w-full">
            {expenses.length === 0 ? (
              <div className="text-center py-20 text-slate-500 font-medium">No transactions recorded yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={splurgeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090c19', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    labelStyle={{ fontWeight: 'bold', color: '#34d399' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Spend']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" name="Amount Spend" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown Donut (Right 1 Column) */}
        <div className="glass-card p-7 rounded-3xl flex flex-col justify-between min-w-0 space-y-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <h3 className="text-white font-extrabold font-sans text-lg">Category Allocation</h3>
              <p className="text-slate-400 text-xs font-medium">Click category to filter in ledger</p>
            </div>
            <select
              value={selectedAllocationMonth}
              onChange={(e) => setSelectedAllocationMonth(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#090c19] border border-white/10 text-slate-200 text-xs font-mono font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-400 cursor-pointer shrink-0 max-w-[120px] truncate"
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
              <div className="text-center py-6 text-slate-500 font-medium">
                <PieIcon className="size-12 mx-auto stroke-slate-700" />
                <p className="text-xs mt-2">No logging details found yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySpendData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={4}
                    dataKey="value"
                    onClick={(entry) => handleCategoryClick(entry.name)}
                    className="cursor-pointer"
                  >
                    {categorySpendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090c19', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN')}`} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {categorySpendData.length > 0 && (
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Top Share</span>
                <span className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">
                  {categorySpendData[0]?.percentage}%
                </span>
              </div>
            )}
          </div>

          {/* Clickable category badges list */}
          <div className="grid grid-cols-2 gap-2 text-xs overflow-y-auto max-h-36 pr-1 custom-scrollbar">
            {categorySpendData.slice(0, 6).map((entry, idx) => (
              <div 
                key={entry.name} 
                onClick={() => handleCategoryClick(entry.name)}
                className="flex items-center gap-2 truncate cursor-pointer hover:bg-white/5 p-1.5 rounded-xl transition-all border border-transparent hover:border-white/10 group"
                title={`Click to view ${entry.name} in ledger`}
              >
                <span className="size-3 rounded-full shrink-0 glow-pill" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-slate-200 truncate font-semibold group-hover:text-emerald-400 transition-colors">{entry.name}</span>
                <span className="text-emerald-400/90 font-mono font-bold text-[10px] shrink-0">({entry.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- NEW CHART 1: Category vs Time Stacked Area Chart ---------------- */}
      <div className="glass-card p-7 rounded-3xl min-w-0 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-extrabold font-sans text-lg">Category Evolution Over Time</h3>
            <p className="text-slate-400 text-xs font-medium">Stacked monthly spending trends across top family categories (Last 6 Months)</p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <LineIcon className="size-5" />
          </div>
        </div>

        <div className="h-64 sm:h-80 w-full">
          {expenses.length === 0 ? (
            <p className="text-slate-500 text-center py-20 text-sm font-medium">No category trend history recorded.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stackedCategoryTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#090c19', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString('en-IN')}`, name]}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px', color: '#94a3b8' }}
                  onClick={(e: any) => {
                    if (e && e.dataKey && e.dataKey !== 'Other') {
                      handleCategoryClick(e.dataKey);
                    }
                  }}
                />
                {[...topCategories, 'Other'].map((cat, idx) => (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stackId="1"
                    stroke={COLORS[idx % COLORS.length]}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={0.7}
                    name={cat}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ---------------- NEW CHART 2: Budget Burn-Down / Spending Pace Spline ---------------- */}
      <div className="glass-card p-7 rounded-3xl min-w-0 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-extrabold font-sans text-lg">Budget Pace & Cumulative Burn-Up</h3>
            <p className="text-slate-400 text-xs font-medium">Tracking actual daily cumulative spend vs. linear target pace limit for this month</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#080b15] border border-white/10 px-3 py-1.5 rounded-xl text-right">
              <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Target Limit</span>
              <AnimatedCounter value={burnDownData.totalBudget} className="text-xs font-extrabold text-white font-mono" />
            </div>
            <div className="bg-[#080b15] border border-white/10 px-3 py-1.5 rounded-xl text-right">
              <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Current Month Spend</span>
              <AnimatedCounter 
                value={burnDownData.currentSpend} 
                className={`text-xs font-extrabold font-mono ${burnDownData.currentSpend > burnDownData.totalBudget ? 'text-rose-400' : 'text-emerald-400'}`} 
              />
            </div>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={burnDownData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#090c19', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                formatter={(v: any, name: any) => [v !== null ? `₹${Number(v).toLocaleString('en-IN')}` : 'N/A', name === 'actual' ? 'Actual Spend' : 'Target Budget Pace']}
              />
              <Line 
                type="monotone" 
                dataKey="targetPace" 
                stroke="#64748b" 
                strokeWidth={2} 
                strokeDasharray="5 5" 
                dot={false} 
                name="Target Pace" 
              />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 3, fill: '#10b981' }} 
                name="Actual Spend" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---------------- NEW CHART 3: Day-of-Week Splurge Heatmap & Matrix ---------------- */}
      <div className="glass-card p-7 rounded-3xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-extrabold font-sans text-lg flex items-center gap-2">
              <Flame className="size-5 text-amber-400" /> Day-of-Week Splurge Heatmap
            </h3>
            <p className="text-slate-400 text-xs font-medium">Analyzing daily spending intensity across Sunday to Saturday</p>
          </div>

          {peakSplurgeDay && peakSplurgeDay.amount > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-xs font-mono font-bold shrink-0">
              <Zap className="size-4 text-amber-400 animate-bounce" />
              <span>Peak Splurge: <b>{peakSplurgeDay.dayName}</b> (₹{peakSplurgeDay.amount.toLocaleString('en-IN')})</span>
            </div>
          )}
        </div>

        {/* Heatmap Grid Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {dayOfWeekData.map((d) => {
            const isPeak = peakSplurgeDay && peakSplurgeDay.dayName === d.dayName && d.amount > 0;
            return (
              <div 
                key={d.dayName}
                className={`glass-panel p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
                  isPeak 
                    ? 'border-amber-500/40 bg-amber-500/5 shadow-lg shadow-amber-500/10' 
                    : 'border-white/5 hover:border-emerald-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold font-mono ${d.isWeekend ? 'text-amber-400' : 'text-slate-300'}`}>
                    {d.dayName}
                  </span>
                  {isPeak && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md font-mono font-extrabold uppercase">
                      Peak
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-base font-extrabold font-mono text-white tracking-tight">
                    ₹{d.amount.toLocaleString('en-IN')}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    {d.count} transaction{d.count === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Heatmap Intensity Meter */}
                <div className="space-y-1">
                  <div className="w-full bg-[#080b15] rounded-full h-2 border border-white/5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isPeak ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${d.intensity}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono font-bold block text-right">
                    {d.percentage}% of total
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group Contribution comparisons */}
      <div className="glass-card p-7 rounded-3xl min-w-0 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-extrabold font-sans text-lg">Group Contribution & Spend Comparison</h3>
            <p className="text-slate-400 text-xs font-medium">Total volume mapped across family sub-groups. Click bar to filter ledger.</p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <Layers className="size-5" />
          </div>
        </div>

        <div className="h-60 sm:h-72 w-full">
          {groupSpendData.length === 0 ? (
            <p className="text-slate-500 text-center py-16 text-sm font-medium">No group data mapped.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupSpendData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#090c19', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  formatter={(v) => `₹${v.toLocaleString('en-IN')}`} 
                />
                <Bar 
                  dataKey="amount" 
                  radius={[10, 10, 0, 0]} 
                  name="Spent"
                  onClick={(entry) => handleGroupClick(entry.id)}
                  className="cursor-pointer"
                >
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
      <div className="glass-card p-7 rounded-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-extrabold font-sans text-lg">Monthly Budget Targets & Consumption</h3>
            <p className="text-slate-400 text-xs font-medium">Tracking active spending targets per family group</p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <Activity className="size-5" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
              <div 
                key={grp.id} 
                onClick={() => handleGroupClick(grp.id)}
                className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3.5 flex flex-col justify-between cursor-pointer hover:border-emerald-500/30 transition-all group"
                title="Click to view group expenses in ledger"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">{grp.name.split(' (')[0]}</span>
                  {grp.monthlyBudget && grp.monthlyBudget > 0 ? (
                    <span className="text-xs bg-[#090c19] border border-white/10 text-slate-300 px-3 py-1 rounded-xl font-mono font-bold">
                      Limit: ₹{grp.monthlyBudget.toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic font-semibold">No budget limit set</span>
                  )}
                </div>

                {grp.monthlyBudget && grp.monthlyBudget > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400 font-medium">
                        Spent: <b className="text-white font-bold">₹{spentThisMonth.toLocaleString('en-IN')}</b>
                      </span>
                      <span className={`font-extrabold text-xs ${budgetPercentage > 100 ? 'text-rose-400' : budgetPercentage > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {Math.round(budgetPercentage)}%
                      </span>
                    </div>

                    <div className="w-full bg-[#080b15] rounded-full h-2.5 border border-white/5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          budgetPercentage > 100 
                            ? 'bg-rose-500' 
                            : budgetPercentage > 75 
                              ? 'bg-amber-400' 
                              : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                      />
                    </div>

                    {budgetPercentage > 100 && (
                      <div className="text-xs text-rose-300 font-semibold flex items-center gap-2 animate-pulse bg-rose-955/30 border border-rose-500/30 p-2 rounded-xl mt-1">
                        ⚠️ Limit Exceeded! Splurge warning active for this subgroup.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-1 font-medium">Set monthly limit under "Family & Groups" settings menu to track progress.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Splurge Modal Details */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card border border-white/10 rounded-3xl p-7 w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col space-y-6 relative overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4 shrink-0">
              <div>
                <h3 className="text-white font-extrabold font-sans text-xl flex items-center gap-2.5 gradient-text-aurora">
                  <Activity className="size-6 text-emerald-400" /> Complete Spending Trend Breakdown
                </h3>
                <p className="text-slate-400 text-xs mt-1 font-medium">
                  Historical month-on-month expense spline logs since first transaction.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
              <div className="glass-panel p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Total Spent (All-Time)</span>
                <AnimatedCounter value={totalAllTimeSpend} className="text-lg font-extrabold text-white font-mono mt-1 block" />
              </div>
              <div className="glass-panel p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Average Monthly Spend</span>
                <AnimatedCounter value={avgMonthlySpend} className="text-lg font-extrabold text-emerald-400 font-mono mt-1 block" />
              </div>
              <div className="glass-panel p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Tracked Months</span>
                <span className="text-lg font-extrabold text-white font-mono mt-1 block">{splurgeTrendAllMonths.length}</span>
              </div>
              <div className="glass-panel p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Transactions Count</span>
                <span className="text-lg font-extrabold text-white font-mono mt-1 block">{expenses.length}</span>
              </div>
            </div>

            {/* Split layout: Chart vs Table */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* Detailed Chart (Left 3 cols) */}
              <div className="lg:col-span-3 h-64 lg:h-full min-h-[250px] glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block mb-2">Visual Spline Curve</span>
                <div className="w-full flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={splurgeTrendAllMonths} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSpendAll" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#090c19', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                        labelStyle={{ fontWeight: 'bold', color: '#34d399' }}
                        formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Spend']}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSpendAll)" name="Spend" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table / List View (Right 2 cols) */}
              <div className="lg:col-span-2 flex flex-col justify-between min-h-[250px] glass-panel border border-white/5 rounded-2xl p-5 overflow-hidden">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block mb-3 shrink-0">Statement Breakdown</span>
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                  {[...splurgeTrendAllMonths].reverse().map((item, idx) => {
                    const maxVal = Math.max(...splurgeTrendAllMonths.map(i => i.amount), 1);
                    const percentageWidth = Math.round((item.amount / maxVal) * 100);

                    return (
                      <div key={idx} className="glass-card p-3 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <span className="text-xs font-bold text-slate-200 block">{item.date}</span>
                          <div className="w-full bg-[#080b15] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full rounded-full transition-all duration-300" style={{ width: `${percentageWidth}%` }} />
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
            <div className="flex justify-end pt-3 border-t border-white/10 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold font-mono rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all"
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
