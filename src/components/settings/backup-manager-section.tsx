'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleAlert, ChevronDown, RotateCcw, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

import { useSettings } from '@/hooks/useSettings'
import { requestAnalyticsRefresh } from '@/lib/analytics-refresh'
import type { BackupStatus, StoredBackupRecord } from '@/lib/backup-manager'

type RestoreTarget =
  | { kind: 'backup'; backup: StoredBackupRecord }

type DeleteTarget = StoredBackupRecord | null

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No backup available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No backup available'
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${dateLabel} \u2022 ${timeLabel}`
}

function getStatusLabel(status: BackupStatus, hasLatestBackup: boolean) {
  if (!hasLatestBackup) return '❌ No backup available'
  if (status.tone === 'good') return '✅ Up to date'
  if (status.tone === 'warn') return '⚠ Backup recommended (older than 2 days)'
  return '❌ No backup available'
}

export default function BackupManagerSection() {
  const { timeFormat, updateTimeFormat } = useSettings()
  const { theme, setTheme } = useTheme()

  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [latestBackup, setLatestBackup] = useState<StoredBackupRecord | null>(null)
  const [automaticBackups, setAutomaticBackups] = useState<StoredBackupRecord[]>([])
  const [status, setStatus] = useState<BackupStatus>({ label: 'No backup available', tone: 'bad', daysOld: null })
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [isDeletingBackup, setIsDeletingBackup] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const clientSettings = useMemo(() => ({
    timeFormat,
    theme: theme || 'system',
  }), [timeFormat, theme])

  const loadBackups = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/user-state/backups', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load backups')
      }

      setLatestBackup(data.latestBackup || null)
      setAutomaticBackups(Array.isArray(data.automaticBackups) ? data.automaticBackups : [])
      setStatus(data.status || { label: 'No backup available', tone: 'bad', daysOld: null })
    } catch (error) {
      console.error('Failed to load backups:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load backups')
      setLatestBackup(null)
      setAutomaticBackups([])
      setStatus({ label: 'No backup available', tone: 'bad', daysOld: null })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      loadBackups()
    })
    return () => window.cancelAnimationFrame(id)
  }, [loadBackups])

  const applyBackupResponse = useCallback((data: unknown) => {
    if (!isObject(data)) return
    setLatestBackup(isObject(data.latestBackup) ? data.latestBackup as StoredBackupRecord : null)
    setAutomaticBackups(Array.isArray(data.automaticBackups) ? data.automaticBackups as StoredBackupRecord[] : [])
    setStatus(isObject(data.status) ? data.status as BackupStatus : { label: 'No backup available', tone: 'bad', daysOld: null })
  }, [])

  const syncCurrentState = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/user-state/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'sync',
          clientSettings,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync backup')
      }

      applyBackupResponse(data)
      requestAnalyticsRefresh()
      toast.success('Current state synced')
    } catch (error) {
      console.error('Sync backup failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to sync backup')
    } finally {
      setIsSyncing(false)
    }
  }

  const selectBackupForRestore = (backup: StoredBackupRecord) => {
    setRestoreTarget({ kind: 'backup', backup })
  }

  const cancelRestore = () => {
    setRestoreTarget(null)
  }

  const closeDeleteModal = () => {
    if (isDeletingBackup) return
    setDeleteTarget(null)
    setDeleteConfirmationText('')
  }

  const confirmRestore = async () => {
    if (!restoreTarget) return

    setIsRestoring(true)
    try {
      const res = await fetch(`/api/user-state/backups/${restoreTarget.backup.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSettings }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore backup')
      }

      if (data.clientSettings?.timeFormat) {
        updateTimeFormat(data.clientSettings.timeFormat)
      }
      if (data.clientSettings?.theme) {
        setTheme(data.clientSettings.theme)
      }

      requestAnalyticsRefresh()
      toast.success('Backup restored')
      window.location.reload()
    } catch (error) {
      console.error('Restore failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to restore backup')
    } finally {
      setIsRestoring(false)
    }
  }

  const previewTitle = restoreTarget?.backup.name || ''

  const confirmDeleteBackup = async () => {
    if (!deleteTarget) return
    if (deleteConfirmationText.trim().toLowerCase() !== 'delete backup' || isDeletingBackup) return

    const target = deleteTarget
    setIsDeletingBackup(true)

    try {
      const res = await fetch(`/api/user-state/backups/${target.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete backup')
      requestAnalyticsRefresh()
      toast.success('Backup deleted')
      await loadBackups()
    } catch (error) {
      console.error('Delete backup failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete backup')
    } finally {
      setIsDeletingBackup(false)
      setDeleteTarget(null)
      setDeleteConfirmationText('')
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Backup Management</h2>
      <div className="border border-border bg-card p-6 space-y-4 text-card-foreground">
        <div className="border border-border p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Last Backup</div>
              <div className="mt-2 text-sm font-bold text-foreground">
                {formatDateTime(latestBackup?.createdAt)}
              </div>
              {latestBackup ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                  {status.tone === 'good' ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : status.tone === 'warn' ? (
                    <CircleAlert size={14} className="text-amber-500" />
                  ) : (
                    <XCircle size={14} className="text-red-500" />
                  )}
                  <span>{getStatusLabel(status, true)}</span>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                  <XCircle size={14} className="text-red-500" />
                  <span>{getStatusLabel(status, false)}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={syncCurrentState}
              disabled={isSyncing}
              className="group inline-flex w-full items-center justify-center gap-3 border border-border px-4 py-3 text-left transition-colors hover:border-green-500/35 hover:bg-green-500/5 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              <div className="text-left">
                <div className="font-bold text-foreground transition-colors group-hover:text-green-700">Sync Current State</div>
                <div className="mt-1 text-xs text-zinc-500 transition-colors group-hover:text-green-700/75">
                  {isSyncing ? 'Syncing...' : 'Update the latest backup now.'}
                </div>
              </div>
              <RotateCcw size={18} className="shrink-0 text-zinc-500 transition-colors group-hover:text-green-600" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((current) => !current)}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-foreground"
        >
          <ChevronDown size={14} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          Backup History
        </button>

        {showHistory ? (
          <div className="space-y-3 border border-border p-4">
            {isLoading ? (
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Loading backups...</div>
            ) : automaticBackups.length === 0 ? (
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">No backup history.</div>
            ) : (
              automaticBackups.map((backup) => (
                <div key={backup.id} className="flex flex-col gap-3 border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{formatDateTime(backup.createdAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => selectBackupForRestore(backup)}
                      className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/user-state/backups/${backup.id}`, { cache: 'no-store' })
                          const data = await res.json()
                          if (!res.ok) throw new Error(data.error || 'Failed to download backup')
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          link.href = url
                          link.download = `${backup.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'backup'}.json`
                          document.body.appendChild(link)
                          link.click()
                          link.remove()
                          URL.revokeObjectURL(url)
                        } catch (error) {
                          console.error('Download backup failed:', error)
                          toast.error(error instanceof Error ? error.message : 'Failed to download backup')
                        }
                      }}
                      className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(backup)}
                      className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {restoreTarget ? (
          <div className="border border-border p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Restore Preview</div>
                <div className="mt-2 text-sm font-bold text-foreground truncate">{previewTitle}</div>
                <div className="mt-1 text-xs text-zinc-500">{formatDateTime(restoreTarget.backup.createdAt)}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={cancelRestore}
                  className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRestore}
                  disabled={isRestoring}
                  className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw size={14} />
                  {isRestoring ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteTarget ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-lg border border-red-500/20 bg-background p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 border border-red-500/20 bg-red-500/5 p-2">
                    <AlertTriangle size={18} className="text-red-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-red-500">Delete Backup</div>
                    <h3 className="mt-2 text-lg font-bold text-foreground">This backup will be permanently removed.</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={isDeletingBackup}
                  className="border border-border p-2 text-zinc-500 transition-colors hover:border-foreground hover:text-foreground"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-zinc-400">
                <p>{deleteTarget.name}</p>
                <p>This removes only the selected backup file. Your current data and other backups stay intact.</p>
                <p>This action cannot be undone.</p>
              </div>

              <div className="mt-5 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Type <span className="text-foreground">delete backup</span> to continue
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(event) => setDeleteConfirmationText(event.target.value)}
                  placeholder='Type "delete backup" to continue'
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isDeletingBackup}
                  className="w-full border border-border bg-background px-3 py-3 text-sm text-foreground focus:border-red-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={isDeletingBackup}
                  className="border border-border px-4 py-3 text-xs font-bold uppercase tracking-widest text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteBackup}
                  disabled={deleteConfirmationText.trim().toLowerCase() !== 'delete backup' || isDeletingBackup}
                  className="border border-red-500/25 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-500 transition-colors hover:border-red-500/40 hover:bg-red-500/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingBackup ? 'Deleting...' : 'Delete Backup'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
