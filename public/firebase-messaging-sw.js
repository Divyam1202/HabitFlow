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
  
  if (payload.data) {
    const notificationTitle = payload.data.title || 'HabytFlow Reminder';
    const notificationOptions = {
      body: payload.data.body || '',
      icon: '/icon-192x192.png',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200, 100, 200, 100, 200], // Loud vibration pattern
      requireInteraction: true, // Keep it visible until action is taken
      data: payload.data
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// Force immediate activation of the new service worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

