import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import OneSignal from 'react-onesignal';

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
   * PWA Implementation using OneSignal Web SDK
   */
  private static async initPWA() {
    if (typeof window === 'undefined') return;
    
    try {
      if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) {
        console.error('OneSignal App ID is missing.');
        return;
      }
      
      // We only want to initialize OneSignal once per page load
      if (!OneSignal.initialized) {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: false, // We use our own UI
          },
        });
      }

      await OneSignal.Slidedown.promptPush();
      
    } catch (error) {
      console.error('Failed to initialize OneSignal:', error);
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
