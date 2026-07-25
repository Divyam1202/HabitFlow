'use client'

import React, { useRef, useState } from 'react'
import { AlertTriangle, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

import { useSettings } from '@/hooks/useSettings'
import { requestAnalyticsRefresh } from '@/lib/analytics-refresh'
import {
  DataImportBundle,
  ImportStrategy,
  parseImportText,
} from '@/lib/data-import'

export default function DataImportSection() {
  const { timeFormat, updateTimeFormat } = useSettings()
  const { theme, setTheme } = useTheme()

  const [strategy, setStrategy] = useState<ImportStrategy>('merge')
  const [fileName, setFileName] = useState('')
  const [fileText, setFileText] = useState('')
  const [bundle, setBundle] = useState<DataImportBundle | null>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'ready' | 'importing'>('idle')
  const [error, setError] = useState('')
  const backupRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setStatus('reading')
    setError('')

    try {
      const text = await file.text()
      const parsed = parseImportText(file.name, text)
      setFileName(file.name)
      setFileText(text)
      setBundle(parsed)
      setStatus('ready')
    } catch (err) {
      setBundle(null)
      setFileName(file.name)
      setFileText('')
      setStatus('idle')
      const message = err instanceof Error ? err.message : 'Failed to read file'
      setError(message)
      toast.error(message)
    }
  }

  const handleImport = async () => {
    if (!fileName || !fileText || !bundle) {
      toast.error('Choose a file first')
      return
    }

    setStatus('importing')
    setError('')

    try {
      const backupRes = await fetch('/api/user-state/export', { cache: 'no-store' })
      const backupData = await backupRes.text()
      if (!backupRes.ok) {
        throw new Error('Failed to capture backup before import')
      }
      backupRef.current = backupData

      const res = await fetch('/api/user-state/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          text: fileText,
          strategy,
          clientSettings: {
            timeFormat,
            theme: theme || 'system',
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      if (data.clientSettings?.timeFormat) {
        updateTimeFormat(data.clientSettings.timeFormat)
      }
      if (data.clientSettings?.theme) {
        setTheme(data.clientSettings.theme)
      }

      requestAnalyticsRefresh()
      toast.success('Import complete')
      window.setTimeout(() => window.location.reload(), 250)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      setError(message)
      toast.error(message)
      if (backupRef.current) {
        console.error('[Import backup captured]', backupRef.current.length)
      }
      setStatus('ready')
    }
  }

  return (
    <div className="w-full space-y-3">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={status === 'importing'}
        className="flex w-full items-center justify-between p-4 border border-border transition-colors text-left group disabled:opacity-60 disabled:cursor-not-allowed hover:border-white/40 hover:bg-white/5"
      >
        <div>
          <div className="font-bold text-foreground transition-colors group-hover:text-white">Import Data</div>
          <div className="text-xs text-zinc-500 mt-1 transition-colors group-hover:text-white/75">
            Choose a backup, JSON, or CSV file.
          </div>
        </div>
        <Upload size={18} className="text-zinc-500 transition-colors group-hover:text-white" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="hidden"
        onChange={handleFileChange}
        disabled={status === 'importing'}
      />

      {fileName ? (
        <div className="flex w-full flex-col gap-3">
          <div className="text-xs text-zinc-500">{fileName}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
              className="h-10 border border-border bg-background px-3 text-xs font-bold uppercase tracking-widest text-foreground focus:outline-none focus:border-foreground"
            >
              <option value="merge">Merge</option>
              <option value="replace">Replace</option>
            </select>

            <button
              type="button"
              onClick={handleImport}
              disabled={status !== 'ready' || !bundle}
              className="inline-flex h-10 items-center justify-center gap-2 border border-border bg-foreground px-4 text-xs font-bold uppercase tracking-widest text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'importing' ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
              Import
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 text-xs text-red-500">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
}
