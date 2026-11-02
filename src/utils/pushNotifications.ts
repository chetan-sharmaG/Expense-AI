/**
 * Web Push Notification Client Utilities
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Service workers or PushManager not supported in this browser.');
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[Push] Service Worker registered with scope:', reg.scope);
    return reg;
  } catch (err) {
    console.error('[Push] Service worker registration failed:', err);
    return null;
  }
}

export async function checkPushStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  hasSubscription: boolean;
}> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, permission: 'denied', hasSubscription: false };
  }

  const permission = Notification.permission;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return {
      supported: true,
      permission,
      hasSubscription: !!sub
    };
  } catch (e) {
    return { supported: true, permission, hasSubscription: false };
  }
}

export async function subscribeUserToPush(token: string): Promise<{ success: boolean; message: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Push notifications are not supported in this browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: 'Notification permission was denied or dismissed.' };
    }

    const reg = await registerServiceWorker();
    if (!reg) {
      return { success: false, message: 'Could not register service worker.' };
    }

    // Get VAPID public key from backend
    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) {
      throw new Error('Failed to retrieve VAPID public key from server');
    }
    const { publicKey } = await keyRes.json();
    if (!publicKey) {
      throw new Error('VAPID public key is empty');
    }

    const convertedKey = urlBase64ToUint8Array(publicKey);
    const existingSub = await reg.pushManager.getSubscription();
    const subscription = existingSub || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey
    });

    // Save subscription in MongoDB
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent
      })
    });

    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to register subscription with server');
    }

    return { success: true, message: 'Push notifications activated! You will receive reminders on the 15th & Month-End.' };
  } catch (err: any) {
    console.error('[Push Subscribe] Error:', err);
    return { success: false, message: err.message || 'Failed to enable push notifications.' };
  }
}

// Trigger custom test cron route
export async function triggerTestCronPush(token: string): Promise<any> {
  const res = await fetch('/api/notifications/test-cron', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: '📅 Mid-Month Ledger Check-in (Test)',
      message: 'Friendly mid-month check-in! Don\'t forget to log your receipts and expenditures for the month.',
      actionUrl: '/expenses?action=add'
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to trigger test push broadcast');
  }
  return await res.json();
}
