'use client'

import React, { useCallback, useEffect, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { TopNav } from '@/components/layout/top-nav'
import { Footer } from '@/components/layout/footer'
import { ActivityTracker } from '@/components/activity-tracker'
import { CanvasLoader } from '@/components/ui/canvas-loader'
import { GatekeeperModal } from '@/components/ui/gatekeeper-modal'
import { Toaster } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { isAdminUser, ADMIN_REDIRECT_PATH } from '@/lib/admin'

const INITIAL_LOADER_SESSION_KEY = 'habitflow_has_seen_initial_loader'
const initialLoaderListeners = new Set<() => void>()
let hasCompletedInitialLoaderThisLoad = false

function subscribeToInitialLoader(listener: () => void) {
  initialLoaderListeners.add(listener)

  return () => {
    initialLoaderListeners.delete(listener)
  }
}

function getInitialLoaderSnapshot() {
  if (typeof window === 'undefined') return false

  // sessionStorage survives reloads. A reload is still a new app boot, so it
  // must show the loader until this document has completed its own cycle.
  if (hasCompletedInitialLoaderThisLoad) return false

  try {
    const navigationEntry = window.performance.getEntriesByType('navigation')[0]
    const isReload = navigationEntry?.toJSON().type === 'reload'

    return isReload || window.sessionStorage.getItem(INITIAL_LOADER_SESSION_KEY) !== 'true'
  } catch {
    return true
  }
}

function getInitialLoaderServerSnapshot() {
  return false
}

function markInitialLoaderSeen() {
  hasCompletedInitialLoaderThisLoad = true

  try {
    window.sessionStorage.setItem(INITIAL_LOADER_SESSION_KEY, 'true')
  } catch {
    // If storage is unavailable, notifying subscribers still hides it for this mounted shell.
  }

  initialLoaderListeners.forEach((listener) => listener())
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const showInitialLoader = useSyncExternalStore(
    subscribeToInitialLoader,
    getInitialLoaderSnapshot,
    getInitialLoaderServerSnapshot,
  )

  const isAdminRoute = pathname?.startsWith('/admin')
  const isAdmin = isAdminUser(user)

  useEffect(() => {
    if (!isLoading && isAdmin && !isAdminRoute) {
      router.replace(ADMIN_REDIRECT_PATH)
    }
  }, [isAdmin, isAdminRoute, isLoading, router])

  const handleInitialLoaderComplete = useCallback(() => {
    markInitialLoaderSeen()
  }, [])

  if (isAdmin && !isAdminRoute) {
    return (
      <>
        {showInitialLoader && <CanvasLoader onComplete={handleInitialLoaderComplete} />}
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
            Redirecting to admin console...
          </div>
        </div>
        <Toaster theme="dark" position="bottom-right" />
      </>
    )
  }

  if (isAdminRoute) {
    return (
      <>
        {showInitialLoader && <CanvasLoader onComplete={handleInitialLoaderComplete} />}
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </>
    )
  }

  return (
    <>
      {showInitialLoader && <CanvasLoader onComplete={handleInitialLoaderComplete} />}
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <ActivityTracker />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <GatekeeperModal />
      </div>
      <Toaster theme="dark" position="bottom-right" />
    </>
  )
}
