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
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground font-panchang">
          Announcements
        </h1>
        <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase mt-1">
          Draft system-wide notices and broadcast messages to segments
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creation Form */}
        <div className="lg:col-span-1 border border-border bg-card p-6 text-card-foreground h-fit">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
            <Bell size={16} /> Publish New Notice
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6 font-sans">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Notice Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Server Maintenance"
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm uppercase tracking-wider font-semibold focus:outline-none"
              >
                <option value="NEW_FEATURE">New Feature</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="BUG_FIXES">Bug Fixes</option>
                <option value="UPDATE_NOTES">Update Notes</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Audience Segment</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm uppercase tracking-wider font-semibold focus:outline-none"
              >
                <option value="ALL_USERS">All Users</option>
                <option value="PREMIUM_USERS">Premium Users Only</option>
                <option value="INACTIVE_USERS">Inactive Users</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Message Body</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement details here..."
                rows={5}
                className="w-full px-4 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={publishing}
              className="w-full py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-foreground/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={14} />}
              Broadcast Notice
            </button>
          </form>
        </div>

        {/* List of past announcements */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
            <Megaphone size={16} /> Broadcast History
          </h3>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="border border-dashed border-border py-12 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
              No notices published yet
            </div>
          ) : (
            <div className="space-y-6">
              {announcements.map((a) => (
                <div key={a.id} className="border border-border bg-card p-6 text-card-foreground">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-base font-bold text-foreground">{a.title}</h4>
                      <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                        Segment: <span className="text-foreground uppercase">{a.audience.replace('_', ' ')}</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 font-bold">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm font-sans leading-relaxed text-zinc-400 whitespace-pre-line mb-4">
                    {a.message}
                  </p>

                  <div className="flex justify-end">
                    <span className="text-[9px] font-mono font-bold tracking-wider px-2.5 py-1 bg-zinc-800 text-zinc-300 uppercase rounded-sm">
                      {a.type.replace('_', ' ')}
                    </span>
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
