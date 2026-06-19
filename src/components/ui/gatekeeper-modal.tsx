'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { authClient } from '@/lib/auth-client'
import { X, CheckCircle } from 'lucide-react'
import { checkUsernameAvailability } from '@/actions/auth-actions'

export function GatekeeperModal() {
  const { showGatekeeper, setShowGatekeeper, onAuthSuccess, isAuthenticated } = useAuth()
  
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null)
  
  const [successMessage, setSuccessMessage] = useState('')
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [otp, setOtp] = useState('')
  const [isAuthenticatedScreen, setIsAuthenticatedScreen] = useState(false)

  useEffect(() => {
    if (isLogin || username.length < 6) {
      setIsUsernameAvailable(null)
      return
    }

    setCheckingUsername(true)
    const timeoutId = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(username)
        setIsUsernameAvailable(available)
      } catch (err) {
        setIsUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [username, isLogin])

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await authClient.emailOtp.verifyEmail({
        email,
        otp
      })

      if (error) throw error
      
      setIsAuthenticatedScreen(true)
      setTimeout(() => {
        onAuthSuccess()
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Invalid OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await authClient.signIn.email({
          email,
          password,
        })
        if (error) {
          if (error.code === 'EMAIL_NOT_VERIFIED' || error?.message?.includes('not verified')) {
            const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
              email,
              type: "email-verification"
            })
            if (otpError) throw otpError
            
            setSuccessMessage('Please verify your email! OTP sent.')
            setShowOtpInput(true)
            setLoading(false)
            return
          }
          throw error
        }
        onAuthSuccess()
      } else {
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters')
        }
        if (username.length < 6 || isUsernameAvailable === false) {
          return
        }
        
        const generatedUsername = username || email.split('@')[0]
        const { data, error } = await authClient.signUp.email({
          email,
          password,
          name: generatedUsername,
          username: generatedUsername,
        })
        
        if (error) {
          if (error.code === 'USER_ALREADY_EXISTS') {
            const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
              email,
              type: "email-verification"
            })
            if (otpError) throw otpError

            setSuccessMessage('Account exists but needs verification! OTP sent.')
            setShowOtpInput(true)
            setLoading(false)
            return
          }
          throw error
        }
        
        // Send the OTP for email verification
        const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification"
        })

        if (otpError) throw otpError

        setSuccessMessage('Email has been sent, check OTP!')
        setShowOtpInput(true)
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  if (!showGatekeeper) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => { if (isAuthenticated) setShowGatekeeper(false) }}
      />
      
      <div className="relative w-full max-w-md bg-card border border-border p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200 text-card-foreground">
        
        {isAuthenticated && (
          <button 
            onClick={() => setShowGatekeeper(false)}
            className="absolute top-4 right-4 text-zinc-500 hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        )}

        {isAuthenticatedScreen ? (
          <div className="flex flex-col items-center justify-center gap-6 py-8 animate-in fade-in zoom-in">
            <CheckCircle size={64} className="text-green-500" />
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">
                Access Granted
              </h2>
              <p className="text-green-500 text-xs uppercase tracking-widest font-bold">
                Authentication Successful
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tighter text-foreground font-panchang">
                {isLogin ? 'ACCESS RESTRICTED' : 'Join HabytFLow'}
              </h2>
              <p className="text-zinc-555 text-xs uppercase tracking-widest font-bold">
                Authentication Required
              </p>
            </div>

            {!showOtpInput && (
              <div className="flex border-b border-border">
                <button
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${isLogin ? 'border-b-2 border-foreground text-foreground' : 'text-zinc-500 hover:text-zinc-700'}`}
                  onClick={() => { setIsLogin(true); setError(''); }}
                >
                  Log In
                </button>
                <button
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${!isLogin ? 'border-b-2 border-foreground text-foreground' : 'text-zinc-500 hover:text-zinc-700'}`}
                  onClick={() => { setIsLogin(false); setError(''); }}
                >
                  Sign Up
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-950/20 border border-red-500/50 text-red-600 dark:text-red-500 text-xs font-bold uppercase tracking-widest text-center">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-green-950/20 border border-green-500/50 text-green-600 dark:text-green-500 text-xs font-bold uppercase tracking-widest text-center">
                {successMessage}
              </div>
            )}

            {showOtpInput ? (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">6-Digit OTP</label>
                  <input 
                    type="text" 
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    className="w-full bg-background border border-border text-foreground p-3 text-center text-2xl tracking-[1em] focus:outline-none focus:border-foreground transition-colors font-mono"
                    maxLength={6}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading || otp.length < 6}
                  className="w-full mt-2 bg-foreground text-background font-black uppercase tracking-widest py-3 text-xs hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP & Authenticate'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border text-foreground p-3 text-sm focus:outline-none focus:border-foreground transition-colors"
                  />
                </div>

                {!isLogin && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Username</label>
                      {username.length > 0 && username.length < 6 && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Too Short</span>
                      )}
                      {username.length >= 6 && (
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${checkingUsername ? 'text-yellow-500' : isUsernameAvailable ? 'text-green-500' : 'text-red-500'}`}>
                          {checkingUsername ? 'Checking...' : isUsernameAvailable ? 'Available' : 'Not Available'}
                        </span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      className={`w-full bg-background border ${username.length >= 6 && isUsernameAvailable === false ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} text-foreground p-3 text-sm focus:outline-none transition-colors`}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Password</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-border text-foreground p-3 text-sm focus:outline-none focus:border-foreground transition-colors tracking-widest"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading || (!isLogin && (username.length < 6 || isUsernameAvailable === false))}
                  className="w-full mt-2 bg-foreground text-background font-black uppercase tracking-widest py-3 text-xs hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : isLogin ? 'Authenticate' : 'Create Account'}
                </button>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  )
}
