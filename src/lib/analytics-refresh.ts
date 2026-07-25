'use client'

export const ANALYTICS_REFRESH_EVENT = 'habytflow:analytics-refresh'
const ANALYTICS_REFRESH_STORAGE_KEY = 'habytflow:analytics-refresh-ts'
const ANALYTICS_REFRESH_CHANNEL = 'habytflow-analytics-refresh'

export function requestAnalyticsRefresh() {
  if (typeof window === 'undefined') return

  const timestamp = String(Date.now())

  window.dispatchEvent(new Event(ANALYTICS_REFRESH_EVENT))

  try {
    window.localStorage.setItem(ANALYTICS_REFRESH_STORAGE_KEY, timestamp)
  } catch {
    // Ignore storage failures.
  }

  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(ANALYTICS_REFRESH_CHANNEL)
      channel.postMessage(timestamp)
      channel.close()
    } catch {
      // Ignore broadcast failures.
    }
  }
}

export function getAnalyticsRefreshStorageKey() {
  return ANALYTICS_REFRESH_STORAGE_KEY
}

export function getAnalyticsRefreshChannelName() {
  return ANALYTICS_REFRESH_CHANNEL
}
