'use client'

import React, { useState, useEffect } from 'react'
import { Download, LogOut, Trash2, CheckCircle2, Check, X, AlertTriangle, Activity, Bell } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/auth-context'
import { useHabitContext } from '@/contexts/habit-context'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'

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
  
  const [health, setHealth] = useState<{
    fcmTokenRegistered: boolean
    lastNotificationDelivered: boolean
    timezone: string
  } | null>(null)
  const [swActive, setSwActive] = useState(false)
  const [permissionState, setPermissionState] = useState<string>('default')
  const [sendingTest, setSendingTest] = useState(false)

  const { gridData: habits } = useHabitContext()
  const [triggeringHabit, setTriggeringHabit] = useState<number | null>(null)

  const triggerHabitReminder = async (habitId: number) => {
    setTriggeringHabit(habitId)
    try {
      const res = await fetch('/api/notifications/manual-habit-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Reminder sent for habit: "${data.habitName || 'Habit'}"`)
      } else {
        toast.error(data.error || 'Failed to send reminder', {
          description: data.details || 'Check console/logs for more details.'
        })
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setTriggeringHabit(null)
    }
  }

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

    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setPermissionState(Notification.permission)
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          setSwActive(regs.length > 0)
        })
      }
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      checkNotifHealth()
    }
  }, [isAuthenticated])

  const sendTestNotification = async () => {
    setSendingTest(true)
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Test notification sent successfully!')
      } else {
        toast.error(data.error || 'Failed to send test notification', {
          description: data.details || 'Check console/logs for more details.'
        })
      }
      checkNotifHealth()
    } catch (err: any) {
      toast.error('Failed to send test notification: ' + err.message)
    } finally {
      setSendingTest(false)
    }
  }

  useEffect(() => {
    if (user) {
      setUsername(user.name || 'divyam_1202')
      setEmail(user.email || 'divyam@example.com')
    }
  }, [user])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Authenticating...
        </div>
      </div>
    )
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
      setTimeout(() => {
        setSyncPhase('idle')
      }, 1500)
    }
  }

  return (
    <>
      <div className="max-w-[800px] mx-auto px-6 pt-12 pb-24 space-y-12">
        
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight">Settings</h1>
          <p className="text-zinc-500 mt-2 text-sm">Manage your application preferences and data.</p>
        </div>

        <div className="space-y-8">
          
          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Account</h2>
            <div className="border border-border bg-card p-6 space-y-6 text-card-foreground">
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-background border border-border text-foreground p-3 text-sm focus:outline-none focus:border-foreground transition-colors"
                />
              </div>

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

              <form onSubmit={handlePasswordEdit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current Password</label>
                  <input 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-background border border-border text-foreground p-3 text-xs focus:outline-none focus:border-foreground transition-colors"
                    placeholder="Enter current password"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">New Password</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1 bg-background border border-border text-foreground p-3 text-xs focus:outline-none focus:border-foreground transition-colors"
                      placeholder="Enter new password (min. 8 chars)"
                      required
                    />
                    <button type="submit" className="px-6 py-3 sm:py-0 bg-foreground text-background font-bold uppercase text-xs tracking-wider hover:bg-foreground/90 transition-colors">
                      Update
                    </button>
                  </div>
                </div>
              </form>

            </div>
          </section>

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

          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Push Notifications Diagnostics</h2>
            <div className="border border-border bg-card p-6 space-y-6 text-card-foreground">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity size={18} className="text-zinc-500" />
                    <div>
                      <div className="font-bold text-foreground">Notifications Permission</div>
                      <div className="text-sm text-zinc-500">Browser notification permission state.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                    {permissionState === 'granted' ? (
                      <span className="text-emerald-500 flex items-center gap-1"><Check size={14} /> Enabled ✅</span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-1"><X size={14} /> Denied / Default ❌</span>
                    )}
                  </div>
                </div>

                <div className="h-px w-full bg-border" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell size={18} className="text-zinc-500" />
                    <div>
                      <div className="font-bold text-foreground">FCM Token Registered</div>
                      <div className="text-sm text-zinc-500">Firebase Cloud Messaging database entry.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                    {health?.fcmTokenRegistered ? (
                      <span className="text-emerald-500 flex items-center gap-1"><Check size={14} /> Registered ✅</span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1"><AlertTriangle size={14} /> Unregistered ⚠️</span>
                    )}
                  </div>
                </div>

                <div className="h-px w-full bg-border" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-zinc-500" />
                    <div>
                      <div className="font-bold text-foreground">Service Worker Status</div>
                      <div className="text-sm text-zinc-500">PWA controller service worker verification.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                    {swActive ? (
                      <span className="text-emerald-500 flex items-center gap-1"><Check size={14} /> Active ✅</span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1"><AlertTriangle size={14} /> Missing ⚠️</span>
                    )}
                  </div>
                </div>

                <div className="h-px w-full bg-border" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity size={18} className="text-zinc-500" />
                    <div>
                      <div className="font-bold text-foreground">Last Notification Delivery</div>
                      <div className="text-sm text-zinc-500">Most recent push status in tracking database.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                    {health?.lastNotificationDelivered ? (
                      <span className="text-emerald-500 flex items-center gap-1"><Check size={14} /> Succeeded ✅</span>
                    ) : (
                      <span className="text-zinc-500 flex items-center gap-1">No Delivery Log</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-xs text-zinc-500">
                  Timezone: <span className="font-mono text-white">{health?.timezone || 'Loading...'}</span>
                </div>
                <button
                  type="button"
                  disabled={sendingTest}
                  onClick={sendTestNotification}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-black font-bold uppercase text-[10px] tracking-widest transition-colors rounded-[2px]"
                >
                  {sendingTest ? 'Sending Push...' : 'Send Test Notification'}
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Habit Reminder Diagnostics</h2>
            <div className="border border-border bg-card p-6 space-y-6 text-card-foreground">
              <div className="text-sm text-zinc-400 leading-relaxed">
                Manually trigger an immediate push notification using actual habit data to verify end-to-end delivery of individual habits.
              </div>
              <div className="space-y-4">
                {habits.length === 0 ? (
                  <div className="text-zinc-500 text-xs uppercase tracking-wider text-center py-4">No habits configured. Go to Manage Habits to add one.</div>
                ) : (
                  habits.map((habit) => (
                    <div key={habit.id} className="flex items-center justify-between p-4 border border-border bg-background/50 rounded-[1px]">
                      <div>
                        <div className="font-bold text-foreground">{habit.name}</div>
                        <div className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
                          {habit.category} • {habit.time} • {habit.notification === 0 ? 'On Time' : `-${habit.notification}m`}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={triggeringHabit === habit.id}
                        onClick={() => triggerHabitReminder(habit.id)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-zinc-800 text-white font-bold uppercase text-[9px] tracking-widest transition-colors rounded-[2px]"
                      >
                        {triggeringHabit === habit.id ? 'Sending...' : 'Send Habit Reminder Now'}
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-4 border-t border-border">
                <a
                  href="/api/debug/notifications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-foreground transition-colors"
                >
                  View Live Matching Diagnostics Report (JSON) &gt;
                </a>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Data Management</h2>
            <div className="border border-border bg-card p-6 flex flex-col gap-4 text-card-foreground">
              <button className="flex items-center justify-between p-4 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-colors text-left group">
                <div>
                  <div className="font-bold text-foreground group-hover:text-background transition-colors">Export Data</div>
                  <div className="text-xs text-zinc-500 mt-1">Download all your habits as JSON.</div>
                </div>
                <Download size={18} className="text-zinc-500 group-hover:text-background transition-colors" />
              </button>
              <button className="flex items-center justify-between p-4 border border-border hover:border-red-650 hover:bg-red-500/10 transition-colors text-left group">
                <div>
                  <div className="font-bold text-red-500">Delete All Data</div>
                  <div className="text-xs text-zinc-500 mt-1">Irreversibly clear your database.</div>
                </div>
                <Trash2 size={18} className="text-red-900 group-hover:text-red-500" />
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* Sync Success Overlay */}
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${syncPhase !== 'idle' ? 'opacity-100 backdrop-blur-md bg-black/80 pointer-events-auto' : 'opacity-0 backdrop-blur-none bg-black/0 pointer-events-none'}`}
      >
        <div className={`flex flex-col items-center gap-6 transition-all duration-500 transform ${syncPhase !== 'idle' ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'}`}>
          
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Background Track */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle 
                cx="48" cy="48" r="44" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="transparent" 
                className="text-zinc-900" 
              />
              {/* Animated Green Loading Ring */}
              <circle 
                cx="48" cy="48" r="44" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="transparent" 
                className="text-green-500 transition-all duration-[1200ms] ease-out"
                strokeDasharray={276}
                strokeDashoffset={syncPhase === 'idle' ? 276 : 0} 
                strokeLinecap="square"
              />
            </svg>

            {/* The Tick */}
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
