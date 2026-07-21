'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { TopNav } from '@/components/layout/top-nav'
import { Footer } from '@/components/layout/footer'
import { ActivityTracker } from '@/components/activity-tracker'
import { GatekeeperModal } from '@/components/ui/gatekeeper-modal'
import { Toaster } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { isAdminUser, ADMIN_REDIRECT_PATH } from '@/lib/admin'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading } = useAuth()

  const isAdminRoute = pathname?.startsWith('/admin')
  const isAdmin = isAdminUser(user)

  useEffect(() => {
    if (!isLoading && isAdmin && !isAdminRoute) {
      router.replace(ADMIN_REDIRECT_PATH)
    }
  }, [isAdmin, isAdminRoute, isLoading, router])

  if (isAdmin && !isAdminRoute) {
    return (
      <>
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
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </>
    )
  }

  return (
    <>
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
