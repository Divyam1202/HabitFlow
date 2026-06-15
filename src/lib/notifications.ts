import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

export class NotificationEngine {
  /**
   * Universal initialization point.
   */
  static async initialize() {
    if (Capacitor.isNativePlatform()) {
      return this.initNative();
    } else {
      return this.initPWA();
    }
  }

  /**
   * PWA Implementation using standard Web Push API
   */
  private static async initPWA() {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        });
        
        // In a real app, send this subscription to the backend
        console.log('PWA Push Subscription created:', subscription);
        // await fetch('/api/notifications/subscribe', { method: 'POST', body: JSON.stringify(subscription) });
      }
    } catch (error) {
      console.error('Failed to initialize PWA notifications:', error);
    }
  }

  /**
   * Native Implementation using Capacitor
   */
  private static async initNative() {
    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') return;

      // Register with FCM/APNs
      await PushNotifications.register();

      PushNotifications.addListener('registration', (token) => {
        // In a real app, send this token to the backend
        console.log('Native Push Token:', token.value);
        // await fetch('/api/notifications/subscribe', { method: 'POST', body: JSON.stringify({ token: token.value }) });
      });

      // Request local notification permissions for recurring offline alarms
      await LocalNotifications.requestPermissions();
    } catch (error) {
      console.error('Failed to initialize native notifications:', error);
    }
  }

  /**
   * Schedule Offline Recurring Alarms (Capacitor Only)
   */
  static async scheduleLocalAlarm(id: number, title: string, body: string, hour: number, minute: number) {
    if (!Capacitor.isNativePlatform()) return; // PWA handles this via Server Cron
    
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id,
          title,
          body,
          schedule: { on: { hour, minute }, repeats: true }
        }]
      });
    } catch (error) {
      console.error('Failed to schedule local alarm:', error);
    }
  }
}
