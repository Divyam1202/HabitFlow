'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { ANALYTICS_REFRESH_EVENT, getAnalyticsRefreshChannelName, getAnalyticsRefreshStorageKey } from '@/lib/analytics-refresh'
import type { AnalyticsHistorySnapshot } from '@/utils/analytics'

export function useAnalyticsSnapshot() {
  const { isAuthenticated, isLoading } = useAuth()
  const [snapshot, setSnapshot] = useState<AnalyticsHistorySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSnapshot = useCallback(async () => {
    if (!isAuthenticated) {
      setSnapshot(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/user-state/export', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed to load analytics export: ${response.status}`)
      }

      const payload = await response.json() as AnalyticsHistorySnapshot
      if (payload?.relatedData) {
        setSnapshot(payload)
      } else {
        setSnapshot(null)
        setError('Analytics snapshot payload is missing related data')
      }
    } catch (error) {
      setSnapshot(null)
      setError(error instanceof Error ? error.message : 'Failed to load analytics export')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadSnapshot is async; setState calls happen after await, not synchronously in the effect body
    void loadSnapshot()
  }, [isLoading, loadSnapshot])

  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthenticated) return

    const refresh = () => {
      void loadSnapshot()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === getAnalyticsRefreshStorageKey()) {
        refresh()
      }
    }

    window.addEventListener(ANALYTICS_REFRESH_EVENT, refresh)
    window.addEventListener('storage', handleStorage)

    let channel: BroadcastChannel | null = null
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(getAnalyticsRefreshChannelName())
      channel.onmessage = refresh
    }

    return () => {
      window.removeEventListener(ANALYTICS_REFRESH_EVENT, refresh)
      window.removeEventListener('storage', handleStorage)
      channel?.close()
    }
  }, [isAuthenticated, loadSnapshot])

  return {
    snapshot,
    loading: isLoading || loading,
    error,
    reloadSnapshot: loadSnapshot,
  }
}