importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Must match your exact web app configuration matrix
firebase.initializeApp({
  apiKey: "AIzaSyA6QPlUzTgHW-aiCDkBMMiVsWDUDePSWmM",
  authDomain: "habytflow-2026.firebaseapp.com",
  projectId: "habytflow-2026",
  storageBucket: "habytflow-2026.firebasestorage.app",
  messagingSenderId: "384678892711",
  appId: "1:384678892711:web:9eaf526c7e7d258c247782"
});

const messaging = firebase.messaging();

// Handle background notification triggers
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.data?.title || payload.notification?.title || 'HabytFlow Reminder';
  
  let actions = undefined;
  if (payload.notification?.actions) {
    actions = payload.notification.actions;
  }
  if (!actions && payload.data?.habitId) {
    actions = [
      { action: 'complete', title: 'Complete ✓' },
      { action: 'snooze', title: 'Snooze 15m ⏳' },
      { action: 'skip', title: 'Skip ✗' }
    ];
  }

  let customData = {
    url: payload.data?.actionUrl || payload.data?.url || '/'
  };
  if (payload.data) {
    customData.habitId = payload.data.habitId;
    customData.habitName = payload.data.habitName;
    customData.category = payload.data.category;
    customData.scheduledTime = payload.data.scheduledTime;
  }

  const notificationOptions = {
    body: payload.data?.body || payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    actions: actions,
    data: customData
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click redirects and actions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};
  const habitId = notificationData.habitId;
  const habitName = notificationData.habitName;
  const category = notificationData.category;

  console.log('[firebase-messaging-sw.js] Notification click action:', action, 'Data:', notificationData);

  if (action === 'complete') {
    event.waitUntil(
      fetch('/api/notification/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId })
      })
      .then(res => {
        if (res.ok) {
          return res.json().then(data => {
            return self.registration.showNotification('Habit Completed!', {
              body: `Great job! "${data.habitName || habitName || 'Habit'}" has been marked as completed.`,
              icon: '/favicon.ico',
              badge: '/icon-192x192.png',
              tag: 'action-confirm',
              vibrate: [100, 50, 100]
            });
          });
        } else {
          console.error('Failed to complete habit via action');
        }
      })
      .catch(err => console.error('Error fetching complete endpoint:', err))
    );
  } else if (action === 'snooze') {
    event.waitUntil(
      fetch('/api/notification/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId, habitName, category })
      })
      .then(res => {
        if (res.ok) {
          return self.registration.showNotification('Habit Snoozed', {
            body: `"${habitName || 'Habit'}" has been snoozed. We will remind you again.`,
            icon: '/favicon.ico',
            badge: '/icon-192x192.png',
            tag: 'action-confirm',
            vibrate: [100]
          });
        }
      })
      .catch(err => console.error('Error fetching snooze endpoint:', err))
    );
  } else if (action === 'skip') {
    event.waitUntil(
      fetch('/api/notification/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId, habitName, category })
      })
      .catch(err => console.error('Error fetching skip endpoint:', err))
    );
  } else {
    // Direct notification click
    event.waitUntil(
      Promise.all([
        fetch('/api/notification/opened', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ habitId, habitName, category })
        }).catch(err => console.error('Error fetching opened endpoint:', err)),
        
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          const urlToOpen = new URL(notificationData.url || '/', self.location.origin).href;
          for (let i = 0; i < windowClients.length; i++) {
            let client = windowClients[i];
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          if (self.clients.openWindow) {
            return self.clients.openWindow(urlToOpen);
          }
        })
      ])
    );
  }
});

// Force immediate activation of the new service worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

