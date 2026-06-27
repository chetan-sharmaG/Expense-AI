/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { DBState } from '../types';
import { 
  TrendingUp, 
  PieChart as PieIcon, 
  Layers,
  Activity,
  BarChart3
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

  // 4. Daily Spending Trends (Past 10 Days of logged activities)
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
        const dateObj = new Date(exp.date);
        const diffTime = Math.abs(new Date().getTime() - dateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 14) {
          dailyMap[exp.date] = (dailyMap[exp.date] || 0) + exp.amount;
        }
      }
    });

    return Object.keys(dailyMap).sort().map(date => {
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
      {/* Visual Analytics Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111420]/80 p-6 rounded-2xl text-white shadow-sm border border-white/5 relative overflow-hidden backdrop-blur-md">
        <div className="relative z-10">
          <h1 className="text-xl font-bold tracking-tight font-sans flex items-center gap-2">
            <Activity className="size-5 text-emerald-450" /> Spending Visual Analysis
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Track daily cumulative spend trends, category budget shares, and sub-group contributions.
          </p>
        </div>
      </div>

      {/* Daily trend and Category breakdown */}
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
            {expenses.length === 0 ? (
              <div className="text-center py-20 text-slate-500">No transactions recorded yet.</div>
            ) : (
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
            )}
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
    </div>
  );
}
