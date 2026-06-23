'use client'

import { useState, useEffect } from 'react'
import { Download, Share, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(true) // Always visible by default
  const [isIos, setIsIos] = useState(false)
  const [showIosDialog, setShowIosDialog] = useState(false)
  const [showAndroidDialog, setShowAndroidDialog] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    if (typeof window === 'undefined') return

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstallable(false)
      return
    }

    const userAgent = window.navigator.userAgent.toLowerCase()
    const checkIos = () => {
      return /iphone|ipad|ipod/.test(userAgent) || (userAgent.includes("mac") && "ontouchend" in document)
    }

    if (checkIos()) {
      setIsIos(true)
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosDialog(true)
      return
    }

    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstallable(false)
      }
      setDeferredPrompt(null)
    } else {
      // Fallback instruction dialog for Android/mobile/desktop browsers if native prompt is blocked/unavailable
      setShowAndroidDialog(true)
    }
  }

  if (!isInstallable) return null

  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 mb-2 font-bold"
        onClick={handleInstallClick}
      >
        <Download className="h-4 w-4" />
        Install App
      </Button>

      {/* iOS Installation Instructions */}
      <Dialog open={showIosDialog} onOpenChange={setShowIosDialog}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-panchang tracking-wider">Install HabytFlow</DialogTitle>
            <DialogDescription className="text-zinc-400 pt-4 text-base flex flex-col gap-4">
              <span>Install this application on your home screen for quick and easy access when you're on the go.</span>
              <span className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg text-sm text-zinc-300">
                1. Tap the <Share className="h-5 w-5 text-blue-500 inline mx-1" /> Share button at the bottom of Safari.
              </span>
              <span className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg text-sm text-zinc-300">
                2. Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>.
              </span>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Android/Desktop fallback Instructions */}
      <Dialog open={showAndroidDialog} onOpenChange={setShowAndroidDialog}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-panchang tracking-wider">Install HabytFlow</DialogTitle>
            <DialogDescription className="text-zinc-400 pt-4 text-base flex flex-col gap-4">
              <span>Install this application on your home screen for quick and easy access when you're on the go.</span>
              <span className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg text-sm text-zinc-300">
                1. Tap the <MoreVertical className="h-5 w-5 text-zinc-400 inline mx-1" /> menu button (three vertical dots) in the browser's top-right corner.
              </span>
              <span className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg text-sm text-zinc-300">
                2. Select <strong className="text-white">"Install app"</strong> or <strong className="text-white">"Add to Home screen"</strong>.
              </span>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
