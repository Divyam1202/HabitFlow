'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, Send, Megaphone, Bell } from 'lucide-react'

interface AnnouncementItem {
  id: string
  title: string
  message: string
  type: 'NEW_FEATURE' | 'MAINTENANCE' | 'BUG_FIXES' | 'UPDATE_NOTES'
  audience: 'ALL_USERS' | 'PREMIUM_USERS' | 'INACTIVE_USERS'
  createdAt: string
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  // Form states
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('NEW_FEATURE')
  const [audience, setAudience] = useState('ALL_USERS')

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/announcements')
      const data = await res.json()
      if (data.announcements) {
        setAnnouncements(data.announcements)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a cascading render loop
    fetchAnnouncements()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return

    try {
      setPublishing(true)
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, type, audience })
      })
      const data = await res.json()
      if (data.success) {
        setTitle('')
        setMessage('')
        await fetchAnnouncements()
      } else {
        alert(data.error || 'Failed to publish announcement')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
          Broadcast Control
        </div>
        <h1 className="font-panchang text-2xl font-black uppercase tracking-tight text-foreground md:text-[2rem]">
          Announcements
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Draft notices and broadcast updates from a compact command surface.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="relative overflow-hidden bg-card/65 p-4 ring-1 ring-white/5">
          <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            <Bell size={15} /> Publish New Notice
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Notice Title">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Server Maintenance"
                className="w-full bg-background px-3 py-2.5 text-sm text-foreground ring-1 ring-white/5 outline-none focus:ring-white/10"
                required
              />
            </Field>

            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-background px-3 py-2.5 text-sm text-foreground ring-1 ring-white/5 outline-none"
              >
                <option value="NEW_FEATURE">New Feature</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="BUG_FIXES">Bug Fixes</option>
                <option value="UPDATE_NOTES">Update Notes</option>
              </select>
            </Field>

            <Field label="Audience Segment">
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full bg-background px-3 py-2.5 text-sm text-foreground ring-1 ring-white/5 outline-none"
              >
                <option value="ALL_USERS">All Users</option>
                <option value="PREMIUM_USERS">Premium Users Only</option>
                <option value="INACTIVE_USERS">Inactive Users</option>
              </select>
            </Field>

            <Field label="Message Body">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement details here..."
                rows={7}
                className="w-full resize-none bg-background px-3 py-2.5 text-sm text-foreground ring-1 ring-white/5 outline-none"
                required
              />
            </Field>

            <button
              type="submit"
              disabled={publishing}
              className="inline-flex w-full items-center justify-center gap-2 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-black transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={14} />}
              Broadcast Notice
            </button>
          </form>
        </div>

        <div className="relative overflow-hidden bg-card/65 p-4 ring-1 ring-white/5">
          <div className="absolute inset-x-0 top-0 h-px bg-sky-400/40" />
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            <Megaphone size={15} /> Broadcast History
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="px-4 py-16 text-center text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              No notices published yet
            </div>
          ) : (
            <div className="space-y-1">
              {announcements.map((a) => (
                <div key={a.id} className="group px-3 py-3 transition-colors hover:bg-white/3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-medium text-white">{a.title}</h4>
                        <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-400 whitespace-pre-line">
                        {a.message}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em]">
                        <span className="border border-white/10 px-2 py-0.5 text-zinc-300">
                          {a.audience.replace('_', ' ')}
                        </span>
                        <span className="border border-sky-500/20 px-2 py-0.5 text-sky-400">
                          {a.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</span>
      {children}
    </label>
  )
}
