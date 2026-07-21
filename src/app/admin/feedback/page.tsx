'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, Check, MessageSquare, AlertCircle, Sparkles } from 'lucide-react'

interface FeedbackItem {
  id: string
  email: string
  type: 'BUG_REPORT' | 'FEATURE_REQUEST' | 'GENERAL_FEEDBACK'
  message: string
  status: 'OPEN' | 'IN_REVIEW' | 'PLANNED' | 'RESOLVED' | 'CLOSED'
  createdAt: string
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchFeedback = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/feedback')
      const data = await res.json()
      if (data.feedback) {
        setFeedback(data.feedback)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedback()
  }, [])

  const updateStatus = async (feedbackId: string, status: string) => {
    try {
      setUpdatingId(feedbackId)
      const res = await fetch('/api/admin/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId, status })
      })
      const data = await res.json()
      if (data.success) {
        setFeedback(prev => prev.map(f => f.id === feedbackId ? { ...f, status: status as any } : f))
      } else {
        alert(data.error || 'Update failed')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredFeedback = feedback.filter(item => {
    const typeMatch = filterType === 'ALL' || item.type === filterType
    const statusMatch = filterStatus === 'ALL' || item.status === filterStatus
    return typeMatch && statusMatch
  })

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
            Moderation Queue
          </div>
          <h1 className="font-panchang text-2xl font-black uppercase tracking-tight text-foreground md:text-[2rem]">
            Feedback Desk
          </h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            Review user-submitted reports, triage issues, and keep the product loop moving.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-card/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-foreground ring-1 ring-white/5 outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="BUG_REPORT">Bugs</option>
            <option value="FEATURE_REQUEST">Features</option>
            <option value="GENERAL_FEEDBACK">General</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-card/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-foreground ring-1 ring-white/5 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="PLANNED">Planned</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="bg-card/65 ring-1 ring-white/5">
          {filteredFeedback.length === 0 ? (
            <div className="px-4 py-16 text-center text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              No feedback items matching filters
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredFeedback.map((item) => (
                <div key={item.id} className="group px-4 py-4 transition-colors hover:bg-white/[0.03]">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                          item.type === 'BUG_REPORT'
                            ? 'border-red-500/20 text-red-400'
                            : item.type === 'FEATURE_REQUEST'
                              ? 'border-sky-500/20 text-sky-400'
                              : 'border-white/10 text-zinc-300'
                        }`}>
                          {item.type === 'BUG_REPORT' ? <AlertCircle size={10} /> : item.type === 'FEATURE_REQUEST' ? <Sparkles size={10} /> : <MessageSquare size={10} />}
                          {item.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-relaxed text-white">
                        {item.message}
                      </p>

                      <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        {item.email}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 xl:justify-end">
                      {updatingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                      ) : (
                        <select
                          value={item.status}
                          onChange={(e) => updateStatus(item.id, e.target.value)}
                          className="bg-background px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground ring-1 ring-white/5 outline-none"
                        >
                          <option value="OPEN">Open</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="PLANNED">Planned</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
