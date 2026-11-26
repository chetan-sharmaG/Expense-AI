import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Clock,
  Calendar,
  Send,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Bot,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  Users,
  ShieldCheck,
  Zap,
  ChevronRight
} from 'lucide-react';

interface ReminderSettings {
  id: string;
  familyId: string;
  enabled: boolean;
  frequency: 'daily' | 'weekdays' | 'custom';
  daysOfWeek: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  time: string; // "21:00"
  message: string;
  channels: {
    telegram: boolean;
    webPush: boolean;
  };
  updatedAt?: string;
  lastSentDate?: string;
}

interface FamilyMemberStatus {
  id: string;
  name: string;
  email: string;
  phone?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  isLinked: boolean;
  inviteUrl: string;
}

interface RemindersViewProps {
  authToken: string;
}

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon', short: 'M' },
  { day: 2, label: 'Tue', short: 'T' },
  { day: 3, label: 'Wed', short: 'W' },
  { day: 4, label: 'Thu', short: 'T' },
  { day: 5, label: 'Fri', short: 'F' },
  { day: 6, label: 'Sat', short: 'S' },
  { day: 0, label: 'Sun', short: 'S' }
];

const TIME_PRESETS = [
  { label: '09:00 AM', value: '09:00' },
  { label: '02:00 PM', value: '14:00' },
  { label: '08:00 PM', value: '20:00' },
  { label: '09:00 PM (Default)', value: '21:00' },
  { label: '10:00 PM', value: '22:00' }
];

export default function RemindersView({ authToken }: RemindersViewProps) {
  const [settings, setSettings] = useState<ReminderSettings>({
    id: 'default_settings',
    familyId: 'fam-1',
    enabled: true,
    frequency: 'daily',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    time: '21:00',
    message: '🌙 Evening expense check-in! Did you make any purchases or payments today? Drop a bill photo or text to log!',
    channels: { telegram: true, webPush: true }
  });

  const [members, setMembers] = useState<FamilyMemberStatus[]>([]);
  const [botUsername, setBotUsername] = useState('sharmasexpense_bot');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch reminder settings and family members status
  const fetchSettings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/reminders/settings', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to load reminder settings');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.users) setMembers(data.users);
      if (data.botUsername) setBotUsername(data.botUsername);
    } catch (err: any) {
      console.error('Error fetching reminder settings:', err);
      setErrorMessage(err.message || 'Unable to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchSettings();
    }
  }, [authToken]);

  // Handle day toggling
  const toggleDay = (day: number) => {
    let newDays = [...settings.daysOfWeek];
    if (newDays.includes(day)) {
      if (newDays.length > 1) {
        newDays = newDays.filter(d => d !== day);
      }
    } else {
      newDays.push(day);
      newDays.sort((a, b) => a - b);
    }

    // Determine frequency type
    let freq: 'daily' | 'weekdays' | 'custom' = 'custom';
    if (newDays.length === 7) freq = 'daily';
    else if (newDays.length === 5 && !newDays.includes(0) && !newDays.includes(6)) freq = 'weekdays';

    setSettings(prev => ({
      ...prev,
      daysOfWeek: newDays,
      frequency: freq
    }));
  };

  const setFrequencyPreset = (freq: 'daily' | 'weekdays' | 'custom') => {
    let days = [0, 1, 2, 3, 4, 5, 6];
    if (freq === 'weekdays') days = [1, 2, 3, 4, 5];
    setSettings(prev => ({
      ...prev,
      frequency: freq,
      daysOfWeek: days
    }));
  };

  // Save settings to backend
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/reminders/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger test reminder
  const handleTestReminder = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/reminders/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger test reminder');
      const tgCount = data.result?.telegramDeliveredCount || 0;
      const webCount = data.result?.deliveredCount || 0;
      setTestResult(`✅ Test reminder sent! (${tgCount} Telegram messages, ${webCount} web push delivered)`);
      setTimeout(() => setTestResult(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error triggering reminder');
    } finally {
      setIsTesting(false);
    }
  };

  // Copy invite link
  const copyInvite = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const linkedCount = members.filter(m => m.isLinked).length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
        <Loader2 className="size-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium">Loading reminder schedules & bot hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/40 via-[#0b1022] to-teal-950/30 p-6 md:p-8 border border-emerald-500/20 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Bot className="size-3.5" />
              <span>Telegram Bot Hub & Automated Reminders</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Expense Check-in Reminders
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Automate daily expense reminders to your family over Telegram for 100% free. Customize days, times, and delivery messages.
            </p>
          </div>

          {/* Bot Live Card */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Bot className="size-4" />
              <span>Open @{botUsername}</span>
              <ExternalLink className="size-3.5 opacity-70" />
            </a>
            <button
              onClick={fetchSettings}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition flex items-center justify-center"
              title="Refresh Settings"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / Toast Feedback */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
          <span><b>Preferences saved successfully!</b> Your reminder schedule has been updated in the cloud.</span>
        </div>
      )}
      {testResult && (
        <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-sm flex items-center gap-2.5">
          <Sparkles className="size-5 shrink-0 text-teal-400" />
          <span>{testResult}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5">
          <AlertCircle className="size-5 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Main Config Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Schedule & Message Configuration (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-[#090d18]/80 border border-white/10 p-6 md:p-7 space-y-6 backdrop-blur-xl">
            {/* Master Toggle */}
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BellRing className="size-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Automated Reminders</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Broadcast automated reminders to family members on scheduled days
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Frequency Selection */}
            <div className="space-y-3">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-emerald-400" />
                <span>Repeat Frequency</span>
              </label>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { id: 'daily', label: 'Every Day', desc: 'Mon - Sun' },
                  { id: 'weekdays', label: 'Weekdays', desc: 'Mon - Fri' },
                  { id: 'custom', label: 'Custom Days', desc: 'Pick days' }
                ].map(freq => (
                  <button
                    key={freq.id}
                    type="button"
                    onClick={() => setFrequencyPreset(freq.id as any)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      settings.frequency === freq.id
                        ? 'bg-emerald-500/15 border-emerald-400/50 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-sm font-bold">{freq.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{freq.desc}</div>
                  </button>
                ))}
              </div>

              {/* Day Pills (Mon - Sun) */}
              <div className="pt-2">
                <div className="text-xs text-slate-400 font-medium mb-2">Active Days:</div>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(({ day, label }) => {
                    const isSelected = settings.daysOfWeek.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`size-11 rounded-2xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 border-emerald-300 text-slate-950 shadow-md shadow-emerald-500/20 scale-105'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                        }`}
                        title={label}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time of Day */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="size-3.5 text-emerald-400" />
                <span>Reminder Time (IST / Asia/Kolkata)</span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="time"
                  value={settings.time}
                  onChange={e => setSettings(prev => ({ ...prev, time: e.target.value }))}
                  className="px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white font-mono text-base focus:outline-none focus:border-emerald-400/50 w-full sm:w-44"
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {TIME_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, time: preset.value }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                        settings.time === preset.value
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Message Template Customization */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-emerald-400" />
                  <span>Reminder Prompt Message</span>
                </label>
                <span className="text-[11px] text-slate-500">{settings.message.length}/200</span>
              </div>

              <textarea
                rows={3}
                maxLength={200}
                value={settings.message}
                onChange={e => setSettings(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter customized reminder text..."
                className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-emerald-400/50 resize-none leading-relaxed"
              />
            </div>

            {/* Delivery Channels */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Delivery Channels
              </label>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings.channels.telegram}
                    onChange={e => setSettings(prev => ({
                      ...prev,
                      channels: { ...prev.channels, telegram: e.target.checked }
                    }))}
                    className="size-4 rounded accent-emerald-500 cursor-pointer"
                  />
                  <span>Telegram Bot (Free & Unlimited)</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings.channels.webPush}
                    onChange={e => setSettings(prev => ({
                      ...prev,
                      channels: { ...prev.channels, webPush: e.target.checked }
                    }))}
                    className="size-4 rounded accent-emerald-500 cursor-pointer"
                  />
                  <span>Web Push Notifications</span>
                </label>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestReminder}
                disabled={isTesting}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-sm transition cursor-pointer hover:border-emerald-400/30 disabled:opacity-50"
              >
                {isTesting ? (
                  <Loader2 className="size-4 animate-spin text-emerald-400" />
                ) : (
                  <Send className="size-4 text-emerald-400" />
                )}
                <span>Send Test Reminder Now</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin text-slate-950" />
                ) : (
                  <Check className="size-4 text-slate-950" />
                )}
                <span>Save Schedule</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Family Member Telegram Roster (1 Col) */}
        <div className="space-y-6">
          <div className="rounded-3xl bg-[#090d18]/80 border border-white/10 p-6 space-y-5 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Family Bot Status</h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                {linkedCount}/{members.length} Connected
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Family members linked to Telegram receive reminder notifications and can log expenses by chatting with the bot.
            </p>

            {/* Member List */}
            <div className="space-y-3">
              {members.map(member => (
                <div
                  key={member.id}
                  className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-white/20 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-white">{member.name}</div>
                    {member.isLinked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Check className="size-3" /> Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Unlinked
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 font-mono truncate">
                    {member.phone ? `+${member.phone}` : member.email}
                  </div>

                  {/* If not linked, show 1-click invite link */}
                  {!member.isLinked && (
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyInvite(member.id, member.inviteUrl)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedId === member.id ? (
                          <>
                            <Check className="size-3 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3 text-slate-400" />
                            <span>Copy Bot Link</span>
                          </>
                        )}
                      </button>
                      <a
                        href={member.inviteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition"
                        title="Open Invite in Telegram"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Instructions box */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5 text-xs text-slate-300">
              <div className="font-bold text-emerald-400 flex items-center gap-1">
                <Sparkles className="size-3.5" />
                <span>Tip: Family Group Chat</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Create a Telegram group with your family and add <b>@{botUsername}</b>! When anyone drops a bill, the bot scans it and logs it for the whole group.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
