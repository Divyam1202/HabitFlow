'use client'

import React, { useState, useEffect } from 'react'
import { Rocket, Send, ArrowLeft, Bug, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export default function ContactPage() {
  const router = useRouter()
  const { user } = useAuth()
  
  const [email, setEmail] = useState('')
  const [type, setType] = useState('issue')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email)
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !message) return

    setStatus('loading')

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type, message })
      })

      if (res.ok) {
        setStatus('success')
        if (!user?.email) {
          setEmail('')
        }
        setMessage('')
      } else {
        setStatus('error')
      }
    } catch (err) {
      setStatus('error')
    }
  }

  return (
    <div className="max-w-[800px] mx-auto px-6 pt-12 pb-24 space-y-12">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 text-zinc-500 hover:text-foreground uppercase tracking-widest text-xs font-bold transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold uppercase tracking-tight">Contact Us</h1>
        <p className="text-zinc-500 mt-2 text-sm">Have an issue or a feature request? Let us know.</p>
      </div>

      <div className="border border-border bg-card p-8 relative overflow-hidden text-card-foreground">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-foreground/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Your Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@example.com"
              required
              className="bg-background border border-border text-foreground p-4 text-sm focus:outline-none focus:border-foreground transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Request Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="bg-background border border-border text-foreground p-4 text-sm focus:outline-none focus:border-foreground transition-colors uppercase tracking-widest"
            >
              <option value="issue" className="bg-background text-foreground">Issue / Bug Report</option>
              <option value="feature_request" className="bg-background text-foreground">Feature Request</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Message</label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help you?"
              required
              rows={5}
              className="bg-background border border-border text-foreground p-4 text-sm focus:outline-none focus:border-foreground transition-colors resize-y"
            />
          </div>

          <button 
            type="submit" 
            disabled={status === 'loading'}
            className="w-full bg-foreground text-background py-4 font-bold uppercase tracking-widest text-xs hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Sending...' : 'Submit Request'}
            <Send size={16} />
          </button>

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center gap-3 mt-6 p-6 border border-green-900/50 bg-green-950/20 text-green-500 text-xs font-bold uppercase tracking-widest text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              {type === 'issue' ? (
                <>
                  <Bug size={28} className="animate-bounce text-green-400" />
                  <span>Stay tuned, your bugs will get fixed soon!</span>
                </>
              ) : (
                <>
                  <Sparkles size={28} className="animate-pulse text-green-400" />
                  <span>Stay tuned to see your feature updated!</span>
                </>
              )}
            </div>
          )}
          {status === 'error' && (
            <div className="text-red-500 text-xs font-bold uppercase tracking-widest text-center mt-4">
              Failed to send request. Try again.
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
