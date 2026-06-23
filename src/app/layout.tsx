import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TopNav } from '@/components/layout/top-nav'
import { Footer } from '@/components/layout/footer'
import { ActivityTracker } from '@/components/activity-tracker'
import { HabitProvider } from '@/contexts/habit-context'
import { AuthProvider } from '@/contexts/auth-context'
import { GatekeeperModal } from '@/components/ui/gatekeeper-modal'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const panchang = localFont({
  src: '../fonts/Panchang-Variable.ttf',
  variable: '--font-panchang',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'HabytFLow | Modern Habit Tracker',
  description: 'Track your daily habits on a monthly calendar view',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HabytFLow',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${panchang.variable} font-sans bg-background text-foreground antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <HabitProvider>
              <TooltipProvider>
                <div className="min-h-screen flex flex-col">
                  <TopNav />
                  <ActivityTracker />
                  <main className="flex-1">
                    {children}
                  </main>
                  <Footer />
                  <GatekeeperModal />
                  <Toaster theme="dark" position="bottom-right" />
                </div>
              </TooltipProvider>
            </HabitProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
