import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.habytflow.app',
  appName: 'HabytFlow',
  webDir: 'public',
  server: {
    url: 'https://habyt-flow.vercel.app/',
    allowNavigation: [
      'habyt-flow.vercel.app',
      '*.googleusercontent.com',
      '*.googleapis.com',
      '*.firebaseapp.com'
    ],
    cleartext: true
  }
};

export default config;
