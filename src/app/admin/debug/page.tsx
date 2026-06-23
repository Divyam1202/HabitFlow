'use client'

import React, { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Clock, Search, RefreshCw, Filter, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

interface NotificationLog {
  _id: string
  userId: string
  habitId: string
  habitName: string
  notificationId?: string
  scheduledTime: string
  triggerTime: string
  timezone: string
  status: string
  errorMessage?: string
  createdAt: string
}

export default function AdminDebugPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchLogs = async () => {
    try {
      setLoading(true)
      let url = '/api/admin/notification-logs'
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      const qs = params.toString()
      if (qs) url += `?${qs}`

      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch notification logs')
      const data = await res.json()
      setLogs(data.logs || [])
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [statusFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-red-500/10 text-red-500 rounded border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </span>
        )
      case 'delivered':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> Delivered
          </span>
        )
      case 'opened':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-blue-500/10 text-blue-500 rounded border border-blue-500/20">
            Opened
          </span>
        )
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-green-500/10 text-green-500 rounded border border-green-500/20">
            Completed
          </span>
        )
      case 'skipped':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">
            Skipped
          </span>
        )
      case 'snoozed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-purple-500/10 text-purple-500 rounded border border-purple-500/20">
            Snoozed
          </span>
        )
      case 'scheduled':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-zinc-500/10 text-zinc-400 rounded border border-zinc-500/20">
            <Clock className="w-3.5 h-3.5" /> Scheduled
          </span>
        )
      case 'evaluated':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20">
            Evaluated
          </span>
        )
      case 'matched':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-pink-500/10 text-pink-400 rounded border border-pink-500/20">
            Matched
          </span>
        )
      case 'sent':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
            Sent
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-zinc-500/10 text-zinc-400 rounded border border-zinc-500/20">
            <Clock className="w-3.5 h-3.5" /> {status}
          </span>
        )
    }
  }

  return (
    <div className="p-8 space-y-8 min-h-screen bg-zinc-950 text-white font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-widest">
            <ShieldAlert className="w-4 h-4 text-red-500" /> System Debugging
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight mt-1 font-panchang">
            Notification Logs
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Trace notification lifecycles, debug delivery pipelines, and check trigger telemetry.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm font-bold uppercase tracking-wider transition-colors rounded-[2px]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-[2px] flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Entries</span>
          <span className="text-2xl font-black mt-2 font-panchang">{logs.length}</span>
        </div>
        <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-[2px] flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Failed</span>
          <span className="text-2xl font-black mt-2 font-panchang text-red-500">
            {logs.filter(l => l.status === 'failed').length}
          </span>
        </div>
        <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-[2px] flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Delivered</span>
          <span className="text-2xl font-black mt-2 font-panchang text-emerald-500">
            {logs.filter(l => l.status === 'delivered').length}
          </span>
        </div>
        <div className="border border-zinc-900 bg-zinc-900/30 p-5 rounded-[2px] flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Completed</span>
          <span className="text-2xl font-black mt-2 font-panchang text-blue-500">
            {logs.filter(l => l.status === 'completed').length}
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="border border-zinc-900 bg-zinc-900/10 p-4 rounded-[2px] flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mr-2">Filter Status:</span>
          {[
            { label: 'All', value: 'all' },
            { label: 'Failed', value: 'failed' },
            { label: 'Delivered', value: 'delivered' },
            { label: 'Pending', value: 'pending' },
            { label: 'Today', value: 'today' },
            { label: 'Last 24 Hours', value: 'last24h' }
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                statusFilter === f.value
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Habit Name or User ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-2 text-xs uppercase tracking-wider focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="border border-zinc-900 bg-zinc-900/10 overflow-x-auto rounded-[2px]">
        {loading ? (
          <div className="py-20 text-center text-xs font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
            Querying database records...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-xs font-bold uppercase tracking-widest text-zinc-500">
            No matching notification logs found.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-950 font-bold uppercase text-zinc-400 tracking-wider">
                <th className="p-4">User</th>
                <th className="p-4">Habit</th>
                <th className="p-4">Scheduled</th>
                <th className="p-4">Trigger Time</th>
                <th className="p-4">Status</th>
                <th className="p-4">Error / Detail</th>
                <th className="p-4">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-b border-zinc-900/50 hover:bg-zinc-900/20 transition-colors">
                  <td className="p-4 font-mono text-[10px] text-zinc-400 max-w-[120px] truncate" title={log.userId}>
                    {log.userId}
                  </td>
                  <td className="p-4 font-bold text-white">{log.habitName}</td>
                  <td className="p-4 text-zinc-400 font-mono">{log.scheduledTime}</td>
                  <td className="p-4 text-zinc-400 font-mono">
                    {log.triggerTime} <span className="text-[9px] text-zinc-600">({log.timezone})</span>
                  </td>
                  <td className="p-4">{getStatusBadge(log.status)}</td>
                  <td className="p-4 text-red-400 max-w-[200px] truncate" title={log.errorMessage}>
                    {log.errorMessage || '—'}
                  </td>
                  <td className="p-4 text-zinc-500 font-mono text-[10px]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
