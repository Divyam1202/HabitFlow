'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

export function Footer() {
  const pathname = usePathname()

  if (pathname === '/about') return null

  return (
    <footer className="w-full py-6 bg-background text-center text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500/20 font-medium select-none">
      <div className="max-w-[1400px] mx-auto px-6 flex justify-center items-center">
        <span>© 2026 HabytFlow. All Rights Reserved.</span>
      </div>
    </footer>
  )
}
