import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Web Push
if (process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Initialize Firebase Admin (for native)
if (!getApps().length && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}

export async function POST(req: Request) {
  try {
    const { userId, title, body, url } = await req.json();
    
    // In a real application, you would fetch these from your database based on userId
    // const user = await db.user.findUnique({ where: { id: userId } });
    const user = { webSubscriptions: [] as any[], fcmTokens: [] as string[] }; 

    const promises: Promise<any>[] = [];

    // 1. Dispatch to PWA Targets
    if (user.webSubscriptions && user.webSubscriptions.length > 0) {
      const payload = JSON.stringify({ title, body, url });
      user.webSubscriptions.forEach(sub => {
        promises.push(webpush.sendNotification(sub, payload).catch(e => {
          console.error('Web push failed:', e);
          // Handle stale subscriptions (e.g. HTTP 410)
        }));
      });
    }

    // 2. Dispatch to Native Capacitor Targets via FCM
    if (user.fcmTokens && user.fcmTokens.length > 0 && getApps().length > 0) {
      const message = {
        notification: { title, body },
        data: { url: url || '/dashboard' },
        tokens: user.fcmTokens
      };
      promises.push(getMessaging().sendEachForMulticast(message).catch(e => {
        console.error('FCM push failed:', e);
      }));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error dispatching notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to dispatch notifications' }, { status: 500 });
  }
}
