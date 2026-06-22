import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, Messaging } from "firebase/messaging";
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Prevent duplicate initialization on hot reloads
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  try {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      return getMessaging(app);
    }
    return null;
  } catch (error) {
    console.error("Failed to initialize Firebase Messaging:", error);
    return null;
  }
};

const registerNativePushNotifications = async (userId: string) => {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Create the standard notification channels once on Android
    const channels = ['health', 'career', 'growth', 'spiritual', 'home'];
    const channelNames: Record<string, string> = {
      health: '🏋️ Health',
      career: '💼 Career',
      growth: '🧠 Growth',
      spiritual: '🕉️ Spiritual',
      home: '🏠 Home'
    };

    for (const channelId of channels) {
      await PushNotifications.createChannel({
        id: channelId,
        name: channelNames[channelId],
        description: `Reminders for ${channelId} habits`,
        importance: 5, // High importance
        visibility: 1, // Public
        sound: 'default',
        vibration: true
      }).catch(err => console.error(`Error creating channel ${channelId}:`, err));
    }

    // Register action categories (complete, snooze, skip)
    await PushNotifications.registerActionTypes({
      types: [
        {
          id: 'HABIT_ACTIONS',
          actions: [
            { id: 'complete', title: 'Complete ✓', foreground: true },
            { id: 'snooze', title: 'Snooze 15m ⏳', foreground: true },
            { id: 'skip', title: 'Skip ✗', foreground: true }
          ]
        }
      ]
    }).catch(err => console.error("Error registering action categories:", err));

    // Request permissions
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn("Native push notification permission denied.");
      return;
    }

    // Register with FCM/APNs
    await PushNotifications.register();

    // Listeners
    PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', async (token) => {
      console.log("Native FCM token registered:", token.value);
      try {
        await fetch("/api/user/save-fcm-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, token: token.value }),
        });
        console.log("Native FCM registration token synced to server.");
      } catch (err) {
        console.error("Failed to sync native token to server:", err);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error("Native push registration error:", error);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', async (actionEvent) => {
      const action = actionEvent.actionId;
      const data = actionEvent.notification.data || {};
      const habitId = data.habitId;
      const habitName = data.habitName;
      const category = data.category;

      console.log("Native push action triggered:", action, data);

      if (action === 'complete') {
        try {
          const res = await fetch('/api/habits/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habitId })
          });
          if (res.ok) {
            console.log("Habit complete request successfully processed.");
          }
        } catch (err) {
          console.error("Failed to post habit completion:", err);
        }
      } else if (action === 'snooze') {
        try {
          const res = await fetch('/api/notifications/snooze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habitId, habitName, category })
          });
          if (res.ok) {
            console.log("Habit snooze request successfully processed.");
          }
        } catch (err) {
          console.error("Failed to post habit snooze:", err);
        }
      } else if (action === 'skip') {
        try {
          const res = await fetch('/api/habits/skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habitId, habitName, category })
          });
          if (res.ok) {
            console.log("Habit skip request successfully processed.");
          }
        } catch (err) {
          console.error("Failed to post habit skip:", err);
        }
      }
    });

  } catch (err) {
    console.error("Error setting up native notifications:", err);
  }
};

export const requestAndStoreNotificationToken = async (userId: string) => {
  try {
    if (Capacitor.isNativePlatform()) {
      await registerNativePushNotifications(userId);
      return;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied by user.");
      return;
    }

    // Explicitly register the service worker for Firebase to prevent conflicts with Serwist PWA worker
    let registration;
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging-push-scope",
      });
    }

    const currentToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (currentToken) {
      await fetch("/api/user/save-fcm-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token: currentToken }),
      });
      console.log("FCM registration token synced successfully.");
    } else {
      console.warn("No registration token available. Check your VAPID key configurations.");
    }
  } catch (error) {
    console.error("Error securing push token:", error);
  }
};

