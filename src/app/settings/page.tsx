'use client'

import React, { useState, useEffect } from 'react'
import { Download, Trash2, CheckCircle2, RotateCcw, AlertTriangle, X, Eye, EyeOff } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { requestAndStoreNotificationToken } from '@/lib/firebase'
import DataImportSection from '@/components/settings/data-import-section'
import BackupManagerSection from '@/components/settings/backup-manager-section'
import { requestAnalyticsRefresh } from '@/lib/analytics-refresh'

export default function SettingsPage() {
  const { timeFormat, updateTimeFormat } = useSettings()
  const { user, isAuthenticated, isLoading } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [syncPhase, setSyncPhase] = useState<'idle' | 'loading' | 'success'>('idle')
  const [isExporting, setIsExporting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmationText, setResetConfirmationText] = useState('')
  const [isResetConfirming, setIsResetConfirming] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Notification auto-repair state — not displayed, runs silently
  const [health, setHealth] = useState<{ notificationStatus?: string } | null>(null)
  const [permissionState, setPermissionState] = useState<string>('default')

  const checkNotifHealth = async () => {
    try {
      const res = await fetch('/api/notifications/health-check')
      if (res.ok) {
        const data = await res.json()
        setHealth(data)
      }
    } catch (e) {
      console.error(e)
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission)
    }
  }

  // Silently fetch health on mount so the repair effect can evaluate
  useEffect(() => {
    if (isAuthenticated) {
      const id = window.requestAnimationFrame(() => {
        checkNotifHealth()
      })
      return () => window.cancelAnimationFrame(id)
    }
  }, [isAuthenticated])

  // Auto-repair: if token is invalid and permission is granted, force-refresh silently
  useEffect(() => {
    if (isAuthenticated && user?.id && permissionState === 'granted' && health?.notificationStatus === 'invalid_token') {
      console.log('[FCM] Stale token detected — silently refreshing...')
      requestAndStoreNotificationToken(user.id, true).then(() => checkNotifHealth())
    }
  }, [health?.notificationStatus, permissionState, isAuthenticated, user?.id])

  useEffect(() => {
    if (user) {
      const id = window.requestAnimationFrame(() => {
        setUsername(user.name || '')
        setEmail(user.email || '')
      })
      return () => window.cancelAnimationFrame(id)
    }
  }, [user])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="text-sm font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Authenticating...
        </div>
      </div>
    )
  }


  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      const { error } = await authClient.updateUser({
        name: username,
      })
      if (error) {
        toast.error(error.message || 'Failed to update profile')
      } else {
        toast.success('Profile updated')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) {
      toast.error('Please enter both current and new passwords')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    setSyncPhase('loading')

    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true
    })

    if (error) {
      setSyncPhase('idle')
      toast.error(error.message || 'Failed to update password')
    } else {
      setSyncPhase('success')
      setCurrentPassword('')
      setNewPassword('')
      setTimeout(() => setSyncPhase('idle'), 1500)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/user-state/export', { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to export data')
      }

      const exportData = {
        ...data,
        clientSettings: {
          timeFormat,
          theme: theme || 'system',
        },
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      link.href = url
      link.download = `habytflow-export-${user?.email || 'user'}-${date}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success('Export downloaded')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleResetData = async () => {
    setIsResetting(true)
    try {
      const res = await fetch('/api/user-state/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSettings: {
            timeFormat,
            theme: theme || 'system',
          },
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset data')
      }

      requestAnalyticsRefresh()
      toast.success('Data reset')
      window.location.reload()
    } catch (error) {
      console.error('Reset failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reset data')
    } finally {
      setIsResetting(false)
    }
  }

  const openResetModal = () => {
    setResetConfirmationText('')
    setShowResetModal(true)
  }

  const closeResetModal = () => {
    if (isResetConfirming) return
    setShowResetModal(false)
    setResetConfirmationText('')
  }

  const confirmResetPhraseMatches = resetConfirmationText.trim().toLowerCase() === 'reset my data'

  const handleResetConfirmed = async () => {
    if (!confirmResetPhraseMatches || isResetConfirming) return

    setIsResetConfirming(true)
    try {
      await handleResetData()
    } finally {
      setIsResetConfirming(false)
      setShowResetModal(false)
      setResetConfirmationText('')
    }
  }

  const openDeleteModal = () => {
    setDeleteConfirmationText('')
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    if (isDeletingAccount) return
    setShowDeleteModal(false)
    setDeleteConfirmationText('')
  }

  const handleDeleteAccount = async () => {
    const phraseMatches = deleteConfirmationText.trim().toLowerCase() === 'delete my data'
    if (!phraseMatches || isDeletingAccount) return

    setIsDeletingAccount(true)
    try {
      const backupRes = await fetch('/api/user-state/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'pre-destructive',
          clientSettings: {
            timeFormat,
            theme: theme || 'system',
          },
        }),
      })
      const backupData = await backupRes.json()

      if (!backupRes.ok) {
        throw new Error(backupData.error || 'Failed to create final backup')
      }

      requestAnalyticsRefresh()
      const deleteResult = await authClient.deleteUser({
        callbackURL: window.location.origin,
      })

      if (deleteResult?.error) {
        throw new Error(deleteResult.error.message || 'Failed to delete account')
      }

      toast.success('Account deleted')
      router.replace('/')
      router.refresh()
    } catch (error) {
      console.error('Account deletion failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete account')
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteModal(false)
      setDeleteConfirmationText('')
    }
  }

  const deletePhraseMatches = deleteConfirmationText.trim().toLowerCase() === 'delete my data'

  return (
    <>
      <div className="max-w-200 mx-auto px-6 pt-12 pb-24 space-y-12">
        
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight">Settings</h1>
          <p className="text-zinc-500 mt-2 text-sm">Manage your application preferences and data.</p>
        </div>

        <div className="space-y-8">

          {/* Account */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Account</h2>
            <div className="border border-border bg-card p-6 space-y-6 text-card-foreground">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  className="bg-background border border-border text-foreground p-3 text-sm focus:outline-none focus:border-foreground transition-colors"
                />
              </div>
              <form onSubmit={handleProfileUpdate} className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Username</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="flex-1 bg-background border border-border text-foreground p-3 text-sm focus:outline-none focus:border-foreground transition-colors"
                  />
                  <button type="submit" disabled={isSavingProfile} className="px-6 py-3 sm:py-0 bg-foreground text-background font-bold uppercase text-xs tracking-wider hover:bg-foreground/90 transition-colors disabled:opacity-50">
                    {isSavingProfile ? 'Saving...' : 'Update'}
                  </button>
                </div>
              </form>

              <form onSubmit={handlePasswordEdit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current Password</label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? 'text' : 'password'} 
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-background border border-border text-foreground p-3 pr-11 text-xs focus:outline-none focus:border-foreground transition-colors"
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">New Password</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input 
                        type={showNewPassword ? 'text' : 'password'} 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-background border border-border text-foreground p-3 pr-11 text-xs focus:outline-none focus:border-foreground transition-colors"
                        placeholder="Enter new password (min. 8 chars)"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button type="submit" className="px-6 py-3 sm:py-0 bg-foreground text-background font-bold uppercase text-xs tracking-wider hover:bg-foreground/90 transition-colors">
                      Update
                    </button>
                  </div>
                </div>
              </form>

            </div>
          </section>

          {/* Preferences */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Preferences</h2>
            <div className="border border-border bg-card p-6 space-y-6 text-card-foreground">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-foreground">Theme Mode</div>
                  <div className="text-sm text-zinc-500">Force application color scheme.</div>
                </div>
                <select 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="bg-background border border-border text-foreground text-sm px-4 py-2 uppercase tracking-wider focus:outline-none focus:border-foreground"
                >
                  <option value="system">System</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              
              <div className="h-px w-full bg-border" />
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-foreground">Start of Week</div>
                  <div className="text-sm text-zinc-500">Calendar starting day.</div>
                </div>
                <select className="bg-background border border-border text-foreground text-sm px-4 py-2 uppercase tracking-wider focus:outline-none focus:border-foreground">
                  <option>Monday</option>
                  <option>Sunday</option>
                </select>
              </div>

              <div className="h-px w-full bg-border" />
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-foreground">Time Format</div>
                  <div className="text-sm text-zinc-500">Global clock formatting.</div>
                </div>
                <select 
                  value={timeFormat}
                  onChange={(e) => updateTimeFormat(e.target.value as '12h' | '24h')}
                  className="bg-background border border-border text-foreground text-sm px-4 py-2 uppercase tracking-wider focus:outline-none focus:border-foreground"
                >
                  <option value="24h">24 Hour</option>
                  <option value="12h">12 Hour</option>
                </select>
              </div>
            </div>
          </section>

          {/* Data Management */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Data Management</h2>
            <div className="border border-border bg-card p-6 flex flex-col gap-4 text-card-foreground">
              <BackupManagerSection />
              <DataImportSection />

              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="flex items-center justify-between p-4 border border-border transition-colors text-left group disabled:opacity-60 disabled:cursor-not-allowed hover:border-white/40 hover:bg-white/5"
              >
                <div>
                  <div className="font-bold text-foreground transition-colors group-hover:text-white">Export Data</div>
                  <div className="text-xs text-zinc-500 mt-1 transition-colors group-hover:text-white/75">
                    {isExporting ? 'Preparing JSON export...' : 'Download your complete persisted state as JSON.'}
                  </div>
                </div>
                <Download size={18} className="text-zinc-500 transition-colors group-hover:text-white" />
              </button>
              <button
                onClick={openResetModal}
                disabled={isResetting}
                className="flex items-center justify-between p-4 border border-border transition-colors text-left group disabled:opacity-60 disabled:cursor-not-allowed hover:border-amber-500/40 hover:bg-amber-500/5"
              >
                <div>
                  <div className="font-bold text-foreground transition-colors group-hover:text-amber-700">Reset Data</div>
                  <div className="text-xs text-zinc-500 mt-1 transition-colors group-hover:text-amber-700/80">
                    {isResetting ? 'Resetting your app state...' : 'Start with a fresh empty state.'}
                  </div>
                </div>
                <RotateCcw size={18} className="text-zinc-500 transition-colors group-hover:text-amber-600" />
              </button>
              <button
                type="button"
                onClick={openDeleteModal}
                className="flex items-center justify-between p-4 border border-border transition-colors text-left group hover:border-red-500/40 hover:bg-red-500/5"
              >
                <div>
                  <div className="font-bold text-foreground transition-colors group-hover:text-red-600">Delete Account Data</div>
                  <div className="text-xs text-zinc-500 mt-1">Irreversibly clear your database and account.</div>
                </div>
                <Trash2 size={18} className="text-zinc-500 transition-colors group-hover:text-red-600" />
              </button>
            </div>
          </section>

        </div>
      </div>

      {showDeleteModal ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-lg border border-red-500/20 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 border border-red-500/20 bg-red-500/5 p-2">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-red-500">Delete Account Data</div>
                  <h3 className="mt-2 text-lg font-bold text-foreground">This will permanently delete your account.</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeletingAccount}
                className="border border-border p-2 text-zinc-500 transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-zinc-400">
              <p>Your account will be permanently deleted.</p>
              <p>All habits, history, analytics, calendar, nutrition, sports, notes, backups, and settings will be permanently removed.</p>
              <p>This action cannot be undone.</p>
              <p className="text-zinc-300">
                Before deletion, a final backup will be created. This is your last recoverable backup before the account is removed.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Type <span className="text-foreground">delete my data</span> to continue
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(event) => setDeleteConfirmationText(event.target.value)}
                placeholder='Type "delete my data" to continue'
                autoComplete="off"
                spellCheck={false}
                disabled={isDeletingAccount}
                className="w-full border border-border bg-background px-3 py-3 text-sm text-foreground focus:border-red-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeletingAccount}
                className="border border-border px-4 py-3 text-xs font-bold uppercase tracking-widest text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!deletePhraseMatches || isDeletingAccount}
                className="border border-red-500/25 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-500 transition-colors hover:border-red-500/40 hover:bg-red-500/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showResetModal ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-lg border border-amber-500/20 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 border border-amber-500/20 bg-amber-500/5 p-2">
                  <AlertTriangle size={18} className="text-amber-600" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-amber-600">Reset Data</div>
                  <h3 className="mt-2 text-lg font-bold text-foreground">Start with a fresh empty state?</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeResetModal}
                disabled={isResetConfirming}
                className="border border-border p-2 text-zinc-500 transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-zinc-400">
              <p>Your active account data will be reset to a fresh state.</p>
              <p>Before resetting, a recoverable backup will be created automatically.</p>
              <p>This will clear habits, history, analytics, calendar, nutrition, sports, notes, archives, and settings from the current state.</p>
              <p className="text-zinc-300">
                This action is recoverable through the backup created just before the reset.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Type <span className="text-foreground">reset my data</span> to continue
              </label>
              <input
                type="text"
                value={resetConfirmationText}
                onChange={(event) => setResetConfirmationText(event.target.value)}
                placeholder='Type "reset my data" to continue'
                autoComplete="off"
                spellCheck={false}
                disabled={isResetConfirming}
                className="w-full border border-border bg-background px-3 py-3 text-sm text-foreground focus:border-amber-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeResetModal}
                disabled={isResetConfirming}
                className="border border-border px-4 py-3 text-xs font-bold uppercase tracking-widest text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetConfirmed}
                disabled={!confirmResetPhraseMatches || isResetConfirming}
                className="border border-amber-500/25 px-4 py-3 text-xs font-bold uppercase tracking-widest text-amber-600 transition-colors hover:border-amber-500/40 hover:bg-amber-500/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isResetConfirming ? 'Resetting...' : 'Reset Data'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sync Success Overlay */}
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${syncPhase !== 'idle' ? 'opacity-100 backdrop-blur-md bg-black/80 pointer-events-auto' : 'opacity-0 backdrop-blur-none bg-black/0 pointer-events-none'}`}
      >
        <div className={`flex flex-col items-center gap-6 transition-all duration-500 transform ${syncPhase !== 'idle' ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'}`}>
          
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle 
                cx="48" cy="48" r="44" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="transparent" 
                className="text-zinc-900" 
              />
              <circle 
                cx="48" cy="48" r="44" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="transparent" 
                className="text-green-500 transition-all duration-1200 ease-out"
                strokeDasharray={276}
                strokeDashoffset={syncPhase === 'idle' ? 276 : 0} 
                strokeLinecap="square"
              />
            </svg>

            <CheckCircle2 
              size={48} 
              strokeWidth={3} 
              className={`text-green-500 transition-all duration-500 transform ${syncPhase === 'success' ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} 
            />
          </div>

          <h2 className={`text-2xl font-black uppercase tracking-tight text-white drop-shadow-md transition-all duration-500 ${syncPhase !== 'idle' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            {syncPhase === 'success' ? 'Data Sync Successful' : 'Syncing...'}
          </h2>
        </div>
      </div>
    </>
  )
}
