import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, Messaging } from "firebase/messaging";

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

export type NotificationTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'unsupported' | 'permission-denied' | 'missing-vapid-key' | 'missing-token' | 'save-failed' | 'error'; error?: unknown }

export const requestAndStoreNotificationToken = async (userId: string, forceRefresh = false): Promise<NotificationTokenResult> => {
  try {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      return { ok: false, reason: 'unsupported' };
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY.");
      return { ok: false, reason: 'missing-vapid-key' };
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) return { ok: false, reason: 'unsupported' };

    // Only request permission if not already granted — calling requestPermission()
    // on an already-granted PWA triggers Chrome's "Open in browser" banner on every launch
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Notification permission denied by user.");
        return { ok: false, reason: 'permission-denied' };
      }
    }

    // Retrieve the active PWA service worker registration to prevent conflicts
    let registration;
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.ready;
    }

    if (forceRefresh) {
      try {
        await deleteToken(messaging);
        console.log("[FCM Refresh] Old token invalidated.");
      } catch (err) {
        console.warn("Failed to delete stale FCM token:", err);
      }
    }

    const currentToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (currentToken) {
      const response = await fetch("/api/user/save-fcm-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token: currentToken }),
      });
      if (!response.ok) {
        return { ok: false, reason: 'save-failed' };
      }
      console.log("[FCM Refresh] New token registered.");
      if (typeof window !== "undefined") {
        localStorage.setItem(`fcm_token_synced_${userId}`, "true");
      }
      return { ok: true, token: currentToken };
    } else {
      console.warn("No registration token available. Check your VAPID key configurations.");
      return { ok: false, reason: 'missing-token' };
    }
  } catch (error) {
    console.error("Error securing push token:", error);
    return { ok: false, reason: 'error', error };
  }
};

