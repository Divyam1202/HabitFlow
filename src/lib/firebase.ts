import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, Messaging } from "firebase/messaging";

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

export const requestAndStoreNotificationToken = async (userId: string) => {
  try {
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

