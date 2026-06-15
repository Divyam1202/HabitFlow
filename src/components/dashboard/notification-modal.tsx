import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { NotificationEngine } from '@/lib/notifications';

export function NotificationModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show automatically on load if permissions are 'default' (not granted or denied yet)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Small delay to let the dashboard load first
        const timer = setTimeout(() => setShow(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleAllow = async () => {
    try {
      await NotificationEngine.initialize();
      setShow(false);
    } catch (e) {
      console.error(e);
      setShow(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-zinc-950 border border-zinc-800 p-8 max-w-md w-full shadow-2xl relative"
          >
            <button 
              onClick={() => setShow(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50">
                <Bell size={32} className="text-green-500 animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Never Miss a Habit</h2>
                <p className="text-zinc-400 text-sm">
                  Allow push notifications to get timely reminders for your scheduled habits directly on your device.
                </p>
              </div>

              <div className="flex flex-col w-full gap-3 pt-4">
                <button 
                  onClick={handleAllow}
                  className="w-full bg-green-500 hover:bg-green-400 text-black font-black uppercase tracking-widest py-3 transition-colors"
                >
                  Allow Notifications
                </button>
                <button 
                  onClick={() => setShow(false)}
                  className="w-full bg-transparent hover:bg-zinc-900 border border-zinc-800 text-white font-bold uppercase tracking-widest py-3 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
