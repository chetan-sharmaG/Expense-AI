/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DBState, Group, User } from '../types';
import { Users, Layers, Plus, Trash2, Shield, Mail, ArrowRight, UserPlus, Info, Pencil, X } from 'lucide-react';

interface FamilyViewProps {
  state: DBState;
  onAddGroup: (name: string) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onUpdateGroupBudget: (id: string, budget: number) => Promise<void>;
  onAddUser: (user: { name: string; email: string; groupId: string; role: 'admin' | 'member'; whatsappNumber?: string }) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onUpdateUser: (id: string, updatedPayload: Partial<User>) => Promise<void>;
  isSyncing: boolean;
}

export default function FamilyView({
  state,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroupBudget,
  onAddUser,
  onDeleteUser,
  onUpdateUser,
  isSyncing
}: FamilyViewProps) {
  const { family, groups, users } = state;

  // Form states
  const [groupName, setGroupName] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userGroupId, setUserGroupId] = useState(groups[0]?.id || '');
  const [userRole, setUserRole] = useState<'admin' | 'member'>('member');
  const [userWhatsapp, setUserWhatsapp] = useState('');

  // Editing modal states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'member'>('member');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  // Error/Success state helpers
  const [errorMsg, setErrorMsg] = useState('');

  // Editing group budget state
  const [editingGroupBudget, setEditingGroupBudget] = useState<{ id: string; budget: string } | null>(null);

  const handleSaveBudget = async (id: string) => {
    if (!editingGroupBudget) return;
    setErrorMsg('');
    try {
      const budgetNum = Number(editingGroupBudget.budget);
      if (isNaN(budgetNum) || budgetNum < 0) {
        setErrorMsg('Please enter a valid positive number for the budget limit.');
        return;
      }
      await onUpdateGroupBudget(id, budgetNum);
      setEditingGroupBudget(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update group budget.');
    }
  };

  // Handle Group creation
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setErrorMsg('');
    await onAddGroup(groupName);
    setGroupName('');
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditGroupId(user.groupId);
    setEditRole(user.role);
    setEditWhatsapp(user.whatsappNumber || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMsg('');
    try {
      await onUpdateUser(editingUser.id, {
        name: editName,
        email: editEmail,
        groupId: editGroupId,
        role: editRole,
        whatsappNumber: editWhatsapp
      });
      setEditingUser(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update member profile.');
    }
  };

  // Handle User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim() || !userGroupId) {
      setErrorMsg('All fields name, email, and group allocation are required.');
      return;
    }

    setErrorMsg('');
    await onAddUser({
      name: userName,
      email: userEmail,
      groupId: userGroupId,
      role: userRole,
      whatsappNumber: userWhatsapp || undefined
    });

    setUserName('');
    setUserEmail('');
    setUserWhatsapp('');
  };

  return (
    <div className="space-y-6">
      
      {/* Informational intro card */}
      <div className="glass-card p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-extrabold font-sans text-xl gradient-text-aurora">Family Ledger Administration</h2>
          <p className="text-slate-300 text-xs mt-1 font-medium">Define household family unit, subsegments, internal groups, and member profiles.</p>
        </div>
        <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-2xl flex items-center gap-2 font-bold font-mono shrink-0 animate-fade-in">
          <Shield className="size-4 text-emerald-400 shrink-0" />
          <span>Secured Vault Access</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl text-xs font-bold font-mono flex items-center gap-2 animate-bounce">
          <Shield className="size-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main split grid: Admin Controls vs Group Visual Directories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Administration Forms Column (Left 1 Column) */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Create Group Form */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-emerald-400" />
              <h3 className="text-white font-extrabold text-base">Add New Family Group</h3>
            </div>
            
            <form onSubmit={handleCreateGroup} className="space-y-3.5">
              <div className="space-y-1.5">
                <label htmlFor="input-group-name" className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">Group Name</label>
                <input 
                  type="text" 
                  id="input-group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. Parents House, Kids, Rohan & Simran"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-medium disabled:opacity-50"
                />
              </div>

              <button 
                type="submit"
                id="btn-submit-group"
                disabled={isSyncing}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <span className="size-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-4 stroke-[3]" />
                    <span>Register Group</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Create Member Form */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="size-5 text-emerald-400" />
              <h3 className="text-white font-extrabold text-base">Register Family Member</h3>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="space-y-1.5">
                <label htmlFor="input-user-name" className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">Member Full Name</label>
                <input 
                  type="text" 
                  id="input-user-name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. Aunt Meera, Papa, Rohan"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-medium disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="input-user-email" className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">Email Address</label>
                <input 
                  type="email" 
                  id="input-user-email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. rohan.sharma@family.com"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-medium disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="select-user-group" className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">Group Allocation</label>
                <select
                  id="select-user-group"
                  value={userGroupId}
                  onChange={(e) => setUserGroupId(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 font-medium text-slate-200 cursor-pointer disabled:opacity-50"
                >
                  <option value="">Choose sub-group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id} className="bg-[#0c0f1d] text-white">{g.name.split(' (')[0]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="select-user-role" className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">System Role Permission</label>
                <select
                  id="select-user-role"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  disabled={isSyncing}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 font-medium text-slate-200 cursor-pointer disabled:opacity-50"
                >
                  <option value="member" className="bg-[#0c0f1d] text-white">Regular Contributor</option>
                  <option value="admin" className="bg-[#0c0f1d] text-white">System Administrator</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="input-user-whatsapp" className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">WhatsApp Number</label>
                <input 
                  type="text" 
                  id="input-user-whatsapp"
                  value={userWhatsapp}
                  onChange={(e) => setUserWhatsapp(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. 919876543210"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-medium disabled:opacity-50"
                />
              </div>

              <button 
                type="submit"
                id="btn-submit-member"
                disabled={isSyncing}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <span className="size-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Onboarding...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-4 stroke-[3]" />
                    <span>Onboard Member</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Groups Visual Directories (Right 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {groups.map(grp => {
              const groupMembers = users.filter(u => u.groupId === grp.id);

              // Calculate spending this month for this group
              const currentMonthExpenses = state.expenses.filter(exp => {
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
                <div key={grp.id} className="glass-card p-6 rounded-3xl flex flex-col justify-between space-y-4 hover:border-emerald-500/30 transition-all">
                  {/* Card head details */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-white text-base" id={`groups-name-${grp.id}`}>{grp.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">Subgroup ID: {grp.id}</span>
                    </div>
                    {groups.length > 1 && (
                      <button 
                        type="button" 
                        id={`btn-delete-group-${grp.id}`}
                        disabled={isSyncing}
                        onClick={() => {
                          if (confirm(`Do you wish to delete group ${grp.name}? Members will be reassigned.`)) {
                            onDeleteGroup(grp.id);
                          }
                        }}
                        className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors rounded-xl cursor-pointer disabled:opacity-30 border border-transparent hover:border-rose-500/20"
                        title="Remove group allocation"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Budget Tracker Section */}
                  <div className="bg-[#080b15] p-4 rounded-2xl border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider">Monthly Budget</span>
                      {editingGroupBudget?.id === grp.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingGroupBudget.budget}
                            onChange={(e) => setEditingGroupBudget({ ...editingGroupBudget, budget: e.target.value })}
                            className="w-20 px-2 py-1 text-xs bg-[#0c0f1d] border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-400 font-mono font-bold"
                            placeholder="Limit"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveBudget(grp.id)}
                            className="text-xs text-emerald-400 font-bold px-1.5 py-0.5 cursor-pointer bg-emerald-500/10 rounded-md border border-emerald-500/20"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupBudget(null)}
                            className="text-xs text-slate-400 hover:text-white px-1 cursor-pointer"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingGroupBudget({ id: grp.id, budget: String(grp.monthlyBudget || 0) })}
                          className="text-[10px] text-emerald-400 font-bold font-mono flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <Pencil className="size-2.5" /> {grp.monthlyBudget ? 'Change Limit' : 'Set Limit'}
                        </button>
                      )}
                    </div>

                    {grp.monthlyBudget && grp.monthlyBudget > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-semibold text-slate-300">
                            Spent: <b className="text-white font-extrabold">₹{spentThisMonth.toLocaleString('en-IN')}</b>
                          </span>
                          <span className="text-slate-400">
                            Limit: ₹{grp.monthlyBudget.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 border border-white/10 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              budgetPercentage > 100 
                                ? 'bg-gradient-to-r from-rose-500 to-red-500' 
                                : budgetPercentage > 75 
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500' 
                                  : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                            }`}
                            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-400">{Math.round(budgetPercentage)}% consumed</span>
                          {budgetPercentage > 100 && (
                            <span className="text-rose-400 font-bold animate-pulse">⚠️ Limit Exceeded!</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic font-medium">No budget limit set for this group.</p>
                    )}
                  </div>

                  {/* Group Members List */}
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider">Assigned Members ({groupMembers.length})</span>
                    {groupMembers.length === 0 ? (
                      <p className="text-slate-400 text-xs italic py-1 font-medium">No members in this subgroup.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {groupMembers.map(member => (
                          <div key={member.id} className="px-3.5 py-2.5 bg-[#080b15] border border-white/10 rounded-2xl flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-extrabold text-xs shrink-0 font-mono">
                                {member.name[0]}
                              </div>
                              <div className="truncate">
                                <span className="font-bold text-slate-100 block text-xs truncate">{member.name}</span>
                                <span className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                  <Mail className="size-3 text-slate-500 shrink-0" /> {member.email}
                                </span>
                                {member.whatsappNumber && (
                                  <span className="text-[10px] text-emerald-400 truncate flex items-center gap-1 mt-0.5 font-bold font-mono">
                                    <span className="text-[8px] px-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">WA</span> +{member.whatsappNumber}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {member.role === 'admin' ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md font-bold font-mono uppercase">
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-white/5 border border-white/10 text-slate-300 rounded-md font-bold font-mono uppercase">
                                  Member
                                </span>
                              )}

                              {/* Edit member button */}
                              <button
                                type="button"
                                id={`btn-edit-user-${member.id}`}
                                disabled={isSyncing}
                                onClick={() => handleEditClick(member)}
                                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-emerald-400 rounded-lg transition cursor-pointer disabled:opacity-30"
                                title="Edit profile"
                              >
                                <Pencil className="size-3" />
                              </button>
                              
                              {/* User Delete button */}
                              {users.length > 2 && (
                                <button
                                  type="button"
                                  id={`btn-delete-user-${member.id}`}
                                  disabled={isSyncing}
                                  onClick={() => {
                                    if (confirm(`Do you wish to remove member ${member.name} from family list?`)) {
                                      onDeleteUser(member.id);
                                    }
                                  }}
                                  className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer disabled:opacity-30"
                                  title="Delete profile"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick instructions guide */}
          <div className="glass-panel p-5 rounded-3xl border border-white/10 text-xs text-slate-300 flex items-start gap-3 leading-relaxed">
            <Info className="size-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-100">Database & Integrity Guidelines:</p>
              <ul className="list-disc list-inside mt-1.5 space-y-1 font-medium text-slate-300">
                <li>Every family member must belong to an active structural group.</li>
                <li>Deleting a subgroup automatically reassigns member profiles to safety defaults.</li>
                <li>Minimum total active user limit is kept at 2 to ensure settlement split algorithms operate correctly.</li>
              </ul>
            </div>
          </div>

        </div>

      </div>

      {/* Edit Member Modal */}
      {editingUser && (
        <div className="fixed inset-0 min-h-screen z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 relative border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Pencil className="size-4 text-emerald-400" />
                <h3 className="text-white font-extrabold text-base gradient-text-aurora">Edit Family Member</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold font-mono text-slate-400 block">Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-medium disabled:opacity-50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold font-mono text-slate-400 block">Email Address</label>
                <input 
                  type="email" 
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-medium disabled:opacity-50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold font-mono text-slate-400 block">Group Allocation</label>
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 font-medium text-slate-100 cursor-pointer disabled:opacity-50"
                  required
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id} className="bg-[#0c0f1d] text-white">{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold font-mono text-slate-400 block">System Role Permission</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  disabled={isSyncing}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 font-medium text-slate-100 cursor-pointer disabled:opacity-50"
                  required
                >
                  <option value="member" className="bg-[#0c0f1d] text-white">Regular Contributor</option>
                  <option value="admin" className="bg-[#0c0f1d] text-white">System Administrator</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold font-mono text-slate-400 block">WhatsApp Number</label>
                <input 
                  type="text" 
                  value={editWhatsapp}
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. 919876543210"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#080b15] border border-white/10 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-medium disabled:opacity-50"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button 
                  type="button" 
                  disabled={isSyncing}
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold font-mono border border-white/10 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSyncing}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-bold font-mono uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <>
                      <span className="size-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
