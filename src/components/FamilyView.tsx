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
  onAddUser: (user: { name: string; email: string; groupId: string; role: 'admin' | 'member'; whatsappNumber?: string }) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onUpdateUser: (id: string, updatedPayload: Partial<User>) => Promise<void>;
  isSyncing: boolean;
}

export default function FamilyView({
  state,
  onAddGroup,
  onDeleteGroup,
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
      <div className="bg-[#111420]/80 p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
        <div>
          <h2 className="text-white font-bold font-sans text-lg">Family Ledger Administration</h2>
          <p className="text-slate-400 text-xs mt-0.5 font-semibold">Define your household's family name, subsegments, internal groups, and member profiles.</p>
        </div>
        <div className="text-xs text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold shrink-0 animate-fade-in">
          <Shield className="size-4 text-emerald-500 shrink-0" />
          <span>Secured Administrative Access</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-955/20 border border-rose-900/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-bounce">
          <Shield className="size-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main split grid: Admin Controls vs Group Visual Directories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Administration Forms Column (Left 1 Column) */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Create Group Form */}
          <div className="bg-[#111420]/80 p-5 rounded-2xl border border-white/5 shadow-sm space-y-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-emerald-450" />
              <h3 className="text-white font-bold text-sm">Add New Family Group</h3>
            </div>
            
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="input-group-name" className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Group Name</label>
                <input 
                  type="text" 
                  id="input-group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. Parents House, Kids, Rohan & Simran"
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <button 
                type="submit"
                id="btn-submit-group"
                disabled={isSyncing}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <span className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Register Group Setup</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Create Member Form */}
          <div className="bg-[#111420]/80 p-5 rounded-2xl border border-white/5 shadow-sm space-y-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <UserPlus className="size-5 text-emerald-455" />
              <h3 className="text-white font-bold text-sm">Register Family Member</h3>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="input-user-name" className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Member full name</label>
                <input 
                  type="text" 
                  id="input-user-name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. Aunt Meera, Papa, Rohan"
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="input-user-email" className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Email Reference</label>
                <input 
                  type="email" 
                  id="input-user-email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. rohan.sharma@family.com"
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="select-user-group" className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Group Allocation</label>
                <select
                  id="select-user-group"
                  value={userGroupId}
                  onChange={(e) => setUserGroupId(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 rounded-lg focus:outline-none focus:border-emerald-500 font-medium text-slate-350 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Choose sub-group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name.split(' (')[0]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="select-user-role" className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">System Role Permission</label>
                <select
                  id="select-user-role"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 rounded-lg focus:outline-none focus:border-emerald-500 font-semibold text-slate-350 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="member">Regular Split contributor</option>
                  <option value="admin">System Admin reviewer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="input-user-whatsapp" className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">WhatsApp Number</label>
                <input 
                  type="text" 
                  id="input-user-whatsapp"
                  value={userWhatsapp}
                  onChange={(e) => setUserWhatsapp(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. 919876543210"
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <button 
                type="submit"
                id="btn-submit-member"
                disabled={isSyncing}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <span className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Onboarding...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Onboard Family Member</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Groups Visual Directories (Right 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(grp => {
              const groupMembers = users.filter(u => u.groupId === grp.id);

               return (
                <div key={grp.id} className="bg-[#111420]/80 p-5 rounded-2xl border border-white/5 shadow-sm hover:border-emerald-500/20 transition flex flex-col justify-between space-y-4 backdrop-blur-md">
                  {/* Card head details */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base" id={`groups-name-${grp.id}`}>{grp.name}</h4>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase font-mono mt-0.5 block">Subgroup ID: {grp.id}</span>
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
                        className="p-1.5 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 transition-colors rounded-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove group allocation"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Group Members List */}
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Assigned Members ({groupMembers.length})</span>
                    {groupMembers.length === 0 ? (
                      <p className="text-slate-500 text-xs italic py-1">No family members assigned to this subgroup.</p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                        {groupMembers.map(member => (
                          <div key={member.id} className="px-3 py-2 bg-[#090b11] border border-white/5 rounded-xl flex items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="size-7 rounded-full bg-[#1a1e30] border border-white/5 text-slate-205 flex items-center justify-center font-bold text-xs shrink-0 font-sans">
                                {member.name[0]}
                              </div>
                              <div className="truncate">
                                <span className="font-semibold text-slate-200 block text-xs truncate">{member.name}</span>
                                <span className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                  <Mail className="size-3 text-slate-500 shrink-0" /> {member.email}
                                </span>
                                {member.whatsappNumber && (
                                  <span className="text-[10px] text-emerald-450 truncate flex items-center gap-1 mt-0.5 font-bold">
                                    <span className="font-bold text-[8px] px-1 bg-emerald-950 border border-emerald-900 text-emerald-400 rounded mr-0.5 font-mono">WA</span> +{member.whatsappNumber}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {member.role === 'admin' ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 rounded font-bold uppercase">
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[8px] bg-[#1a1e30] border border-white/5 text-slate-405 rounded font-bold uppercase">
                                  Member
                                </span>
                              )}

                              {/* Edit member button */}
                              <button
                                type="button"
                                id={`btn-edit-user-${member.id}`}
                                disabled={isSyncing}
                                onClick={() => handleEditClick(member)}
                                className="p-1 hover:bg-[#1a1e30] text-slate-400 hover:text-emerald-455 rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Edit user profile"
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
                                  className="p-1 hover:bg-rose-955/30 text-slate-450 hover:text-rose-400 rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Delete user profile"
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
          <div className="bg-[#111420]/60 border border-white/5 p-4 rounded-xl text-xs text-slate-400 flex items-start gap-2.5 leading-relaxed backdrop-blur-md">
            <Info className="size-4 text-emerald-450 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Database & Family integrity guidelines:</p>
              <ul className="list-disc list-inside mt-1.5 space-y-1 font-semibold text-slate-450">
                <li>Every sub-family member must belong to at least one structural subgroup.</li>
                <li>Deleting a subgroup automatically shifts any assigned members back into a default safety group.</li>
                <li>A minimum count of 2 total users is kept active to preserve balanced settlement split ratios.</li>
              </ul>
            </div>
          </div>

        </div>

      </div>

      {/* Edit Member Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090e]/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#111420] border border-white/5 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="size-4 text-emerald-450" />
                <h3 className="text-white font-bold text-sm">Edit Family Member</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1a1e30] transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-550 block mb-1">Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-555 block mb-1">Email Reference</label>
                <input 
                  type="email" 
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-555 block mb-1">Group Allocation</label>
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 rounded-lg focus:outline-none focus:border-emerald-500 font-medium text-slate-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-555 block mb-1">System Role Permission</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-white/5 rounded-lg focus:outline-none focus:border-emerald-500 font-semibold text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="member">Regular Split contributor</option>
                  <option value="admin">System Admin reviewer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-555 block mb-1">WhatsApp Number</label>
                <input 
                  type="text" 
                  value={editWhatsapp}
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  disabled={isSyncing}
                  placeholder="e.g. 919876543210"
                  className="w-full px-3 py-2 text-xs bg-[#090b11] border border-[#ffffff]/5 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  disabled={isSyncing}
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 bg-[#1a1e30] hover:bg-[#252b44] text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition text-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSyncing}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm transition text-center flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <>
                      <span className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
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
