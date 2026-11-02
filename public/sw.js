// FamilyFunds Service Worker for Web Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push message
self.addEventListener('push', (event) => {
  let data = {
    title: 'FamilyFunds Ledger Alert',
    body: 'Time to update your family expense records!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: '/expenses?action=add' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [150, 80, 150],
    tag: data.tag || 'familyfunds-reminder',
    renotify: true,
    data: data.data || { url: '/expenses?action=add' },
    actions: [
      { action: 'add_expense', title: '➕ Log Expense' },
      { action: 'open_app', title: '📊 View Ledger' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click event (even when app is closed)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/expenses?action=add';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If no window is open, launch a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
