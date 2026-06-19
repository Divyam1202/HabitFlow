'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, Save, Settings, ShieldAlert, FileText, Key, Palette } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/auth-context'

interface SettingsData {
  siteName: string
  supportEmail: string
  version: string
  allowRegistration: boolean
  maintenanceMode: boolean
  privacyPolicyUrl: string
  termsUrl: string
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Theme support
  const { theme: appTheme, setTheme: setAppTheme } = useTheme()
  const { user } = useAuth()
  const isSuperAdmin = user?.email === 'habytflow@gmail.com' || user?.role === 'SUPER_ADMIN'

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (data.settings) {
          setSettings(data.settings)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings || !isSuperAdmin) return

    try {
      setSaving(true)
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await res.json()
      if (data.success) {
        alert('Settings saved successfully')
      } else {
        alert(data.error || 'Failed to save settings')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'New passwords do not match', type: 'error' })
      return
    }

    try {
      setPasswordChanging(true)
      const { authClient } = await import('@/lib/auth-client')
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true
      })

      if (result.error) {
        setPasswordMessage({ text: result.error.message || 'Failed to change password', type: 'error' })
      } else {
        setPasswordMessage({ text: 'Password updated successfully', type: 'success' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err: any) {
      console.error(err)
      setPasswordMessage({ text: err.message || 'An error occurred', type: 'error' })
    } finally {
      setPasswordChanging(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground font-panchang">
          System Settings
        </h1>
        <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase mt-1">
          Adjust preferences, themes, operational flags, and password security
        </p>
      </div>

      {/* 1. Theme Configuration Card (All Admins) */}
      <div className="border border-border bg-card p-6 text-card-foreground space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <Palette size={16} /> Theme Settings
        </h3>
        <div className="flex items-center justify-between font-sans">
          <div>
            <p className="text-sm font-bold text-foreground">Select Display Theme</p>
            <p className="text-xs text-zinc-500">Choose between light off-beige, cosmic dark, or system matching.</p>
          </div>
          <select
            value={appTheme || 'system'}
            onChange={(e) => setAppTheme(e.target.value)}
            className="bg-background border border-border text-foreground text-sm px-4 py-2 uppercase tracking-wider focus:outline-none focus:border-foreground"
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>

      {/* 2. Password Reset Card (All Admins) */}
      <div className="border border-border bg-card p-6 text-card-foreground space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <Key size={16} /> Change Password
        </h3>
        
        <form onSubmit={handlePasswordChange} className="space-y-4 font-sans">
          {passwordMessage && (
            <div className={`p-4 text-xs font-bold uppercase tracking-wider border ${
              passwordMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'
            }`}>
              {passwordMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={passwordChanging}
            className="w-full py-2.5 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-foreground/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {passwordChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
            Change Password
          </button>
        </form>
      </div>

      {/* 3. Global Site Settings Form (restricted to SUPER_ADMIN) */}
      <form onSubmit={handleSubmit} className="space-y-8 font-sans">
        
        {!isSuperAdmin && (
          <div className="border border-red-500/20 bg-red-500/10 text-red-500 p-4 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
            <ShieldAlert size={16} /> Global Site configuration parameters are restricted to Super Admins.
          </div>
        )}

        {/* General */}
        <div className={`border border-border bg-card p-6 text-card-foreground space-y-6 ${!isSuperAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Settings size={16} /> Site Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Site Name</label>
              <input
                type="text"
                value={settings?.siteName || ''}
                disabled={!isSuperAdmin}
                onChange={(e) => settings && setSettings({ ...settings, siteName: e.target.value })}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Support Email</label>
              <input
                type="email"
                value={settings?.supportEmail || ''}
                disabled={!isSuperAdmin}
                onChange={(e) => settings && setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Build Version</label>
              <input
                type="text"
                value={settings?.version || ''}
                disabled={!isSuperAdmin}
                onChange={(e) => settings && setSettings({ ...settings, version: e.target.value })}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className={`border border-border bg-card p-6 text-card-foreground space-y-6 ${!isSuperAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <ShieldAlert size={16} /> Security Rules & Flags
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Allow Registrations</p>
                <p className="text-xs text-zinc-500">Toggle whether new user registrations are permitted.</p>
              </div>
              <input
                type="checkbox"
                checked={settings?.allowRegistration || false}
                disabled={!isSuperAdmin}
                onChange={(e) => settings && setSettings({ ...settings, allowRegistration: e.target.checked })}
                className="w-4 h-4 accent-foreground cursor-pointer"
              />
            </div>

            <div className="h-px bg-border/40 w-full" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Maintenance Mode</p>
                <p className="text-xs text-zinc-500">Enable to lock the application for updates and maintenance.</p>
              </div>
              <input
                type="checkbox"
                checked={settings?.maintenanceMode || false}
                disabled={!isSuperAdmin}
                onChange={(e) => settings && setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="w-4 h-4 accent-foreground cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className={`border border-border bg-card p-6 text-card-foreground space-y-6 ${!isSuperAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <FileText size={16} /> Legal & Privacy URLs
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Privacy Policy URL</label>
              <input
                type="text"
                value={settings?.privacyPolicyUrl || ''}
                disabled={!isSuperAdmin}
                onChange={(e) => settings && setSettings({ ...settings, privacyPolicyUrl: e.target.value })}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Terms URL</label>
              <input
                type="text"
                value={settings?.termsUrl || ''}
                disabled={!isSuperAdmin}
                onChange={(e) => settings && setSettings({ ...settings, termsUrl: e.target.value })}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>
          </div>
        </div>

        {/* Save Site config button */}
        {isSuperAdmin && (
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-foreground/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
            Save Global Site Configurations
          </button>
        )}

      </form>
    </div>
  )
}
