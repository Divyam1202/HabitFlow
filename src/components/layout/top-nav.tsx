'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sun, Moon, LayoutDashboard, CheckSquare, Calendar, BarChart2, Settings, Menu, X, ShieldAlert, MessageSquare, Info } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/auth-context'
import { PwaInstallButton } from '@/components/pwa-install-button'

export function TopNav() {
  const pathname = usePathname()

  const { theme, setTheme } = useTheme()
  const { isAuthenticated, setShowGatekeeper, user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  const baseLinks = [
    { name: 'Dashboard', href: '/', icon: <LayoutDashboard size={18} /> },
    { name: 'Habits', href: '/habits', icon: <CheckSquare size={18} /> },
    { name: 'Calendar', href: '/calendar', icon: <Calendar size={18} /> },
    { name: 'Analytics', href: '/analytics', icon: <BarChart2 size={18} /> },
    { name: 'Settings', href: '/settings', icon: <Settings size={18} /> },
    { name: 'About', href: '/about', icon: <Info size={18} /> },
    { name: 'Contact Us', href: '/contact', icon: <MessageSquare size={18} /> },
  ]

  const navLinks = user?.email === 'habytflow@gmail.com'
    ? [...baseLinks, { name: 'Admin', href: '/admin', icon: <ShieldAlert size={18} /> }]
    : baseLinks

  if (pathname === '/about') return null

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-zinc-900 bg-black text-white h-14 flex items-center">
        <div className="max-w-[1400px] w-full mx-auto px-6 flex items-center justify-between">

          {/* Logo (All viewports) */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg md:text-xl tracking-tighter z-50 relative font-panchang">
            <div className="w-4 h-4 bg-white rounded-[1px] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-black rounded-[1px]" />
            </div>
            HabytFLow
          </Link>

          {/* Laptop/Desktop Navigation (min-width: 768px) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium tracking-wider uppercase">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative pb-0.5 group transition-colors duration-150 ${isActive ? "text-white" : "text-zinc-500 hover:text-white"}`}
                >
                  {link.name}
                  <span className={`absolute left-0 bottom-0 w-full h-[1px] bg-white transition-transform duration-200 origin-center ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                </Link>
              )
            })}
          </nav>

          {/* Right Section (All viewports) */}
          <div className="flex items-center gap-4 z-50 relative">
            <div className="flex flex-col items-end justify-center gap-0.5">
              <div className="hidden sm:block text-xs font-medium text-zinc-500 tracking-wider uppercase">
                {mounted ? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '...'}
              </div>
              {!isAuthenticated && mounted ? (
                <button
                  onClick={() => setShowGatekeeper(true)}
                  className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors duration-150 underline decoration-zinc-800 hover:decoration-white underline-offset-2"
                >
                  Sign In / Register
                </button>
              ) : mounted && (
                <button
                  onClick={() => {
                    import('@/lib/auth-client').then(({ authClient }) => {
                      authClient.signOut().then(() => window.location.reload())
                    })
                  }}
                  className="text-[10px] uppercase tracking-widest text-red-500/70 hover:text-red-500 transition-colors duration-150 underline decoration-red-900/50 hover:decoration-red-500 underline-offset-2"
                >
                  Sign Out
                </button>
              )}
            </div>
            {mounted && (
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-zinc-500 hover:text-white transition-colors">
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            )}

            {/* Mobile Sidebar Toggle (max-width: 767px) */}
            <button
              className="md:hidden text-zinc-500 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <>
        {/* Backdrop */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar Panel */}
        <div className={`md:hidden fixed inset-y-0 left-0 z-40 w-64 bg-black border-r border-zinc-900 pt-20 px-6 pb-6 flex flex-col transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 p-3 rounded-[1px] transition-colors duration-150 ${isActive ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-white hover:bg-zinc-900/50"}`}
                >
                  <span className={isActive ? "text-white" : "text-zinc-500"}>{link.icon}</span>
                  <span className="text-sm font-bold tracking-widest uppercase">{link.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto border-t border-zinc-900 pt-6">
            <PwaInstallButton />
          </div>
        </div>
      </>
    </>
  )
}
