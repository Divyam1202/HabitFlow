import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HabitProvider } from '@/contexts/habit-context'
import { AuthProvider } from '@/contexts/auth-context'
import { AppShell } from '@/components/app-shell'

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
  title: 'HabytFlow | Modern Habit Tracker',
  description: 'Track your daily habits on a monthly calendar view',
  icons: {
    icon: '/hyf-logo-v2-192.png',
    apple: '/hyf-logo-v2-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HabytFlow',
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
                <AppShell>{children}</AppShell>
              </TooltipProvider>
            </HabitProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
