'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authClient } from '@/lib/auth-client'

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  showGatekeeper: boolean;
  setShowGatekeeper: (show: boolean) => void;
  requireAuth: (action: () => void) => void;
  onAuthSuccess: () => void;
  user: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  const [showGatekeeper, setShowGatekeeper] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const isAuthenticated = !!session && session?.user?.emailVerified === true;
  const isLoading = isPending

  const requireAuth = useCallback((action: () => void) => {
    if (isAuthenticated) {
      action()
    } else {
      setPendingAction(() => action)
      setShowGatekeeper(true)
    }
  }, [isAuthenticated])

  const onAuthSuccess = useCallback(() => {
    setShowGatekeeper(false)
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
  }, [pendingAction])

  useEffect(() => {
    if (isAuthenticated && session?.user?.id) {
      import('react-onesignal').then(mod => {
        const OneSignal = mod.default;
        // In react-onesignal v3+, initialized is not exposed in types.
        // But we can check via type casting or simply login inside the promise.
        // It's safe to call login directly if we know it's imported, 
        // or we can cast it as any to bypass the TS error.
        if ((OneSignal as any).initialized) {
          OneSignal.login(session.user.id);
        }
      }).catch(console.error);
    }
  }, [isAuthenticated, session?.user?.id])

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      showGatekeeper,
      setShowGatekeeper,
      requireAuth,
      onAuthSuccess,
      user: session?.user || null
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
