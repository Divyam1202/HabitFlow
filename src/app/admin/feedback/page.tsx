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
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-foreground font-panchang">
            Feedback Desk
          </h1>
          <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase mt-1">
            Review user-submitted reports and coordinate updates
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-card border border-border text-foreground text-xs px-4 py-2 uppercase tracking-wider font-bold focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="BUG_REPORT">Bugs</option>
            <option value="FEATURE_REQUEST">Features</option>
            <option value="GENERAL_FEEDBACK">General</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-card border border-border text-foreground text-xs px-4 py-2 uppercase tracking-wider font-bold focus:outline-none"
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
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredFeedback.length === 0 ? (
            <div className="col-span-full border border-dashed border-border py-20 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
              No feedback items matching filters
            </div>
          ) : (
            filteredFeedback.map((item) => (
              <div key={item.id} className="border border-border bg-card p-6 flex flex-col justify-between text-card-foreground">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm uppercase flex items-center gap-1.5 ${item.type === 'BUG_REPORT' ? 'bg-red-500/10 text-red-500' :
                        item.type === 'FEATURE_REQUEST' ? 'bg-blue-500/10 text-blue-500' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                      {item.type === 'BUG_REPORT' ? <AlertCircle size={10} /> :
                        item.type === 'FEATURE_REQUEST' ? <Sparkles size={10} /> : <MessageSquare size={10} />}
                      {item.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-foreground mb-4 leading-relaxed whitespace-pre-line">
                    {item.message}
                  </p>
                </div>

                <div className="border-t border-border pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <span className="text-[10px] text-zinc-500 font-semibold truncate max-w-xs">{item.email}</span>

                  {updatingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                  ) : (
                    <select
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value)}
                      className="bg-background border border-border text-foreground text-[10px] px-2.5 py-1 uppercase tracking-wider font-bold focus:outline-none"
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
            ))
          )}
        </div>
      )}
    </div>
  )
}
