'use client'

import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PwaInstallButton() {
  return (
    <a
      href="/HabytFlow.apk"
      download="HabytFlow.apk"
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'default' }),
        "w-full justify-start gap-3 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 mb-2 font-bold"
      )}
    >
      <Download className="h-4 w-4 text-emerald-500" />
      Install App
    </a>
  )
}
