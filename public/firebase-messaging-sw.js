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
  // Do not call self.registration.showNotification here!
  // Since our backend sends a "notification" payload with "webpush" Urgency: "high", 
  // the browser natively handles displaying the loud notification automatically.
});

// Force immediate activation of the new service worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

