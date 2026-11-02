import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  Check, 
  CheckCheck, 
  Trash2, 
  X, 
  Zap, 
  Sparkles, 
  CalendarClock, 
  Plus, 
  Send,
  Loader2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { NotificationItem, DBState } from '../types';
import { checkPushStatus, subscribeUserToPush, triggerTestCronPush } from '../utils/pushNotifications';

interface NotificationCenterProps {
  notifications: NotificationItem[];
  authToken: string;
  onRefreshState: () => Promise<void>;
  onTriggerAddExpense: () => void;
}

export default function NotificationCenter({
  notifications,
  authToken,
  onRefreshState,
  onTriggerAddExpense
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission;
    hasSubscription: boolean;
  }>({ supported: true, permission: 'default', hasSubscription: false });

  const [loadingSubscribe, setLoadingSubscribe] = useState(false);
  const [loadingTestBroadcast, setLoadingTestBroadcast] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Check push subscription status on mount and when modal opens
  const refreshPushStatus = async () => {
    const status = await checkPushStatus();
    setPushStatus(status);
  };

  useEffect(() => {
    refreshPushStatus();
  }, [isOpen]);

  // Handle Subscribe to Browser Push
  const handleEnablePush = async () => {
    setLoadingSubscribe(true);
    setStatusMessage(null);
    try {
      const result = await subscribeUserToPush(authToken);
      setStatusMessage(result.message);
      await refreshPushStatus();
    } catch (e: any) {
      setStatusMessage(e.message || 'Failed to enable push notifications.');
    } finally {
      setLoadingSubscribe(false);
    }
  };

  // Handle Trigger Test Cron Push Broadcast
  const handleTestCronBroadcast = async () => {
    setLoadingTestBroadcast(true);
    setStatusMessage(null);
    try {
      const result = await triggerTestCronPush(authToken);
      setStatusMessage(`🚀 Broadcast sent! ${result.stats?.deliveredCount || 0} push sent, ${result.stats?.usersCount || 0} in-app alerts created.`);
      await onRefreshState();
    } catch (e: any) {
      setStatusMessage(e.message || 'Failed to dispatch test cron push.');
    } finally {
      setLoadingTestBroadcast(false);
    }
  };

  // Mark single as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      await onRefreshState();
    } catch (err) {
      console.error(err);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      await onRefreshState();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      await onRefreshState();
    } catch (err) {
      console.error(err);
    }
  };

  // Format date helper
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        type="button"
        id="btn-notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all flex items-center justify-center cursor-pointer glow-pill"
        title="Ledger Notifications & Reminders"
      >
        {unreadCount > 0 ? (
          <BellRing className="size-4.5 text-amber-400 animate-pulse" />
        ) : (
          <Bell className="size-4.5" />
        )}

        {/* Unread Badge Pill */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[18px] text-[10px] font-mono font-extrabold bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover / Dropdown Drawer */}
      {isOpen && (
        <>
          {/* Invisible backdrop to dismiss */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />

          <div className="absolute right-0 mt-3 w-84 sm:w-96 glass-card rounded-3xl border border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in backdrop-blur-2xl bg-[#090c19]/95 text-slate-100">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <CalendarClock className="size-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white font-sans">Ledger Reminders</h3>
                  <p className="text-[10px] text-slate-400 font-mono font-semibold">15th & Month-End Cron Push</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono font-bold flex items-center gap-1 cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck className="size-3.5" />
                    <span>Read all</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Status Message / Alert Feedback */}
            {statusMessage && (
              <div className="mx-4 mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-medium">
                <Sparkles className="size-3.5 shrink-0 text-emerald-400" />
                <span className="flex-1 text-[11px]">{statusMessage}</span>
                <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="size-3" />
                </button>
              </div>
            )}

            {/* Device Push Permissions & Test Cron Action Card */}
            <div className="p-4 bg-white/5 border-b border-white/10 space-y-3">
              
              {/* Push Subscription Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {pushStatus.hasSubscription ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-mono">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      Push Popups Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 font-mono">
                      <AlertCircle className="size-3 text-amber-400" />
                      Push Popups Inactive
                    </span>
                  )}
                </div>

                {!pushStatus.hasSubscription && (
                  <button
                    type="button"
                    disabled={loadingSubscribe}
                    onClick={handleEnablePush}
                    className="px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-[10px] font-bold font-mono rounded-lg hover:scale-105 transition cursor-pointer flex items-center gap-1"
                  >
                    {loadingSubscribe ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
                    <span>Enable Popups</span>
                  </button>
                )}
              </div>

              {/* Custom Test Cron Broadcast Button */}
              <button
                type="button"
                id="btn-test-cron-broadcast"
                disabled={loadingTestBroadcast}
                onClick={handleTestCronBroadcast}
                className="w-full py-2 px-3 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold font-mono cursor-pointer transition flex items-center justify-center gap-2 group"
                title="Trigger a test broadcast push notification to all users"
              >
                {loadingTestBroadcast ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Dispatched broadcast...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>Test Cron Push (Broadcast to All)</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-400 font-medium text-center">
                Automated cron triggers every 15th & Month-End at 09:00 AM.
              </p>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar max-h-80">
              {notifications.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <div className="size-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
                    <Bell className="size-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-400">No Notifications Yet</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Scheduled mid-month and month-end ledger reminders will appear here and on your device.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                      !notif.read 
                        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5' 
                        : 'bg-white/5 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {!notif.read && (
                          <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                        )}
                        <h4 className="text-xs font-extrabold text-white font-sans">{notif.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 font-medium mt-1 leading-relaxed">
                      {notif.message}
                    </p>

                    {/* Quick action buttons */}
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notif.id);
                          setIsOpen(false);
                          onTriggerAddExpense();
                        }}
                        className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-[10px] font-bold font-mono rounded-lg hover:scale-[1.02] transition flex items-center gap-1 cursor-pointer shadow-md"
                      >
                        <Plus className="size-3 stroke-[3]" />
                        <span>Log Expense</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {!notif.read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                            className="text-slate-400 hover:text-emerald-400 p-1 cursor-pointer transition"
                            title="Mark as read"
                          >
                            <Check className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNotification(notif.id, e)}
                          className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer transition"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
